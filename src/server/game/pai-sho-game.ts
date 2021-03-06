import GameRoom from "../room/game-room.js";
import Player from "../objects/player.js";
import GameBoard from "../../shared/logic/game-board.js";
import { canMoveTileToField, canPerformJump } from "../../shared/logic/tile-moves.js";
import { LotusTile, Tile } from "../../shared/logic/tiles.js";
import Field from "../../shared/logic/field.js";
import { serverIO } from "../socket.js";
import { GameStartEvent, GameStartPacket } from "../../shared/events/game-start.js";
import { GameAbandonEvent } from "../../shared/events/game-abandon.js";
import { GameEndEvent, GameEndPacket } from "../../shared/events/game-end.js";
import { WhoseTurnEvent, WhoseTurnPacket } from "../../shared/events/whose-turn.js";
import { ThrownTile, ThrowTilesEvent, ThrowTilesPacket } from "../../shared/events/throw-tiles.js";
import { TileMovePacket, TileMoveResponseEvent, TileMoveResponsePacket } from "../../shared/events/tile-move.js";
import { InCheckEvent, InCheckPacket } from "../../shared/events/in-check.js";
import { RespawnAvatarEvent, RespawnAvatarPacket } from "../../shared/events/respawn-avatar.js";

export default class PaiShoGame {
    currentPlayer: Player | null = null
    gameBoard = new GameBoard()

    chainJumps: Field[] | null
    tileWhichChainJumps: Tile | null

    constructor(private room: GameRoom) {
        this.gameBoard.loadFields()
        this.gameBoard.lineup.buildLineup()
    }

    start() {
        this.room.allPlayers.forEach(player => {
            const event: GameStartPacket = {
                role: player == this.room.playerA ? "a" : "b",
                myTurn: player == this.room.playerA,
                players: {
                    a: this.room.playerA!!.username,
                    b: this.room.playerB!!.username
                }
            }
            player.socket.emit(GameStartEvent, event)
        })
    }

    abandon() {
        this.room.playerA = null
        this.room.playerB = null
        this.room.allPlayers = []
        this.room.game = new PaiShoGame(this.room)
        this.room.lobby.canJoin = true

        serverIO.to(this.room.id).emit(GameAbandonEvent)
    }

    announceWinner(winner: Player) {
        const loser = this.getOtherPlayer(winner)

        this.room.lobby.canJoin = true
        winner.socket.emit(GameEndEvent, { win: true } as GameEndPacket)
        loser.socket.emit(GameEndEvent, { win: false } as GameEndPacket)
    }

    handleTileMove(player: Player, event: TileMovePacket) {
        if (player != this.currentPlayer) {
            return
        }

        let serverField: { x: number, y: number }
        let isExecutorA: boolean
        let nextPlayer: Player

        if (player == this.room.playerA) {
            serverField = event.field
            isExecutorA = true
            nextPlayer = this.room.playerB!!
        } else if (player == this.room.playerB) {
            serverField = { x: -event.field.x, y: -event.field.y }
            isExecutorA = false
            nextPlayer = this.room.playerA!!
        } else return

        // server-side game board is synced with player A
        const field = this.gameBoard.getField(serverField.x, serverField.y)
        const tile = (isExecutorA ? this.gameBoard.lineup.myTiles : this.gameBoard.lineup.opponentTiles)
            .find(it => it.id == event.tileId)

        if (field == null) return this.room.log("error: cannot find field on server-side");
        if (tile == null) return this.room.log("error: cannot find tile on server-side")
        if (!canMoveTileToField(tile, field)) return this.room.log(`error: cannot move ${tile} to ${field}`)
        if (!this.verifyChainJumps(tile, field)) return this.room.log(`error: invalid chain jump ${tile} to ${field}`)

        const originalField = tile.field!!
        tile.field!!.tile = null
        tile.field = field
        field.tile = tile

        const response: TileMoveResponsePacket = { tileId: event.tileId, field: serverField, isMoveByMe: isExecutorA }
        this.room.playerA!!.socket.emit(TileMoveResponseEvent, response)

        response.isMoveByMe = !isExecutorA
        response.field = { x: -serverField.x, y: -serverField.y }
        this.room.playerB!!.socket.emit(TileMoveResponseEvent, response)

        this.room.log(`${player.username} moved ${event.tileId} to [${serverField.x},${serverField.y}]`)

        const isThrown = this.checkForThrows(tile)
        // must be called after checkForGameEnd()
        this.checkForInCheck()
        const gameEnds = this.checkForGameEnd()
        if (gameEnds) return this.room.log("Game is ending")

        if (!isThrown) {
            this.chainJumps = this.canPerformChainJump(originalField, tile)
            this.tileWhichChainJumps = this.chainJumps != null ? tile : null

            if (this.chainJumps != null) {
                this.room.log(`${player.username} can perform a chain jump`)
                this.setWhoseTurn(player)
                return
            }
        }

        this.setWhoseTurn(nextPlayer)
    }

    /**
     * Returns true if my tile was thrown.
     */
    checkForThrows(myTile: Tile): boolean {
        // neighbour fields that have an enemy tile on them
        const occupiedNeighbourFields = myTile.field!!.getNeighbourFields()
            .filter(field => field.tile != null && field.tile.isDark != myTile.isDark)

        // calculate all tiles that i can throw
        const totalThrows: ThrownTile[] = occupiedNeighbourFields
            .filter(field => myTile.canThrow(field.tile!!))
            .map(field => {
                const obj = {
                    thrower: { tile: myTile.id, isMyTile: true },
                    victim: { tile: field.tile!!.id }
                };
                field.tile!!.setThrown()
                return obj;
            })

        // check if a still standing tile can throw me
        const candidate = occupiedNeighbourFields.find(field => field.tile?.canThrow(myTile))

        // if so, push the throw to the total throws array
        if (candidate != null) {
            totalThrows.push({
                thrower: { tile: candidate.tile!!.id, isMyTile: false },
                victim: { tile: myTile.id }
            })
            myTile.setThrown()
        }

        if (totalThrows.length > 0) {
            const event: ThrowTilesPacket = { actions: totalThrows }
            this.currentPlayer!!.socket.emit(ThrowTilesEvent, event)

            const otherPlayer = this.getOtherPlayer(this.currentPlayer!!);
            // invert 'isMyTile' property before sending to other player
            event.actions.forEach(action => action.thrower.isMyTile = !action.thrower.isMyTile)
            otherPlayer.socket.emit(ThrowTilesEvent, event)

            totalThrows.forEach(action => {
                // revert inversion
                const performer = !action.thrower.isMyTile ? this.currentPlayer : otherPlayer;
                this.room.log(`${performer!!.username} threw ${action.victim.tile} with ${action.thrower.tile}`)

                if (action.victim.tile == "avatar") {
                    const other = this.getOtherPlayer(performer!!);
                    this.room.log(`${other.username} has lost his avatar`)
                    other.lostAvatar = true
                }
            })
        }

        return candidate != null
    }

    checkForInCheck() {
        const lotusA = this.gameBoard.lineup.myTiles.find(it => it.id == "lotus") as LotusTile
        const lotusB = this.gameBoard.lineup.opponentTiles.find(it => it.id == "lotus") as LotusTile

        for (let player of this.room.allPlayers) {
            const prev = player.inCheck
            const now = !!(player == this.room.playerA ? lotusA : lotusB).getTileByWhichInCheck()

            if (prev && now) player.secondTimeInCheck = true
            if (prev != now) player.socket.emit(InCheckEvent, { inCheck: now } as InCheckPacket)

            player.inCheck = now
        }
    }

    checkForGameEnd(): boolean {
        const lotusA = this.gameBoard.lineup.myTiles.find(it => it.id == "lotus") as LotusTile
        const lotusB = this.gameBoard.lineup.opponentTiles.find(it => it.id == "lotus") as LotusTile

        let winner: Player

        if (this.room.playerB!!.secondTimeInCheck || lotusA.bringsVictory() || lotusB.isInCheckMate()) {
            winner = this.room.playerA!!
        } else if (this.room.playerA!!.secondTimeInCheck || lotusB.bringsVictory() || lotusA.isInCheckMate()) {
            winner = this.room.playerB!!
        } else return false

        this.announceWinner(winner)
        this.room.log(`${winner.username} wins the game`)
        return true
    }

    canPerformChainJump(originalField: Field, tile: Tile): Field[] | null {
        const wasJump = !(tile instanceof LotusTile) && canPerformJump(tile, originalField, tile.field!!)
        if (!wasJump) return null

        const fields = Object.values(this.gameBoard.fields).filter(field => canPerformJump(tile, tile.field!!, field));
        return fields.length == 0 ? null : fields;
    }

    handlePassChainJump(player: Player) {
        if (this.currentPlayer == player && this.chainJumps != null) {
            this.chainJumps = null
            this.setWhoseTurn(this.getOtherPlayer(player))
            this.room.log(`${player.username} finished his move`)
        }
    }

    setWhoseTurn(nextPlayer: Player) {
        this.currentPlayer = nextPlayer
        this.room.allPlayers.forEach(player => {
            const event: WhoseTurnPacket = { myTurn: player == nextPlayer }
            if (event.myTurn && this.chainJumps != null) {
                const n = player == this.room.playerA ? 1 : -1
                event.chainJumps = this.chainJumps.map(f => ({ x: f.x * n, y: f.y * n }))
                event.tileWhichChainJumps = this.tileWhichChainJumps!!.id
            }
            player.socket.emit(WhoseTurnEvent, event)
        })

        if (nextPlayer.lostAvatar) {
            const n = nextPlayer == this.room.playerA ? 1 : -1
            const avatarField = this.gameBoard.getField(4 * n, 4 * n)!!

            if (avatarField.tile == null) {
                this.room.log(`Respawned ${nextPlayer.username}'s avatar`)
                this.gameBoard.lineup.respawnAvatar({ myAvatar: this.room.playerA == nextPlayer })
                nextPlayer.lostAvatar = false

                this.room.allPlayers.forEach(player => {
                    player.socket.emit(RespawnAvatarEvent, { myAvatar: player == nextPlayer } as RespawnAvatarPacket)
                })
            }
        }
    }

    /**
     * If the player is allowed to perform a chain-jump, this function makes sure that
     * the given field is a potential target of such a chain-jump. If no chain-jumps
     * are available, this function returns true for all fields.
     */
    verifyChainJumps(tile: Tile, field: Field): boolean {
        return this.chainJumps == null || (this.chainJumps.some(cj => field.equals(cj)) && tile.equals(this.tileWhichChainJumps))
    }

    getOtherPlayer(p: Player): Player {
        return p == this.room.playerA ? this.room.playerB!! : this.room.playerA!!
    }
}