import Player from "../objects/player.js";
import PaiShoGame from "../game/pai-sho-game.js";
import { TileMoveEvent } from "../../shared/move-events.js";

export default class GameRoom {
    playerA: Player | null = null
    playerB: Player | null = null
    allPlayers: Player[] = []

    readonly game: PaiShoGame = new PaiShoGame(this)

    constructor(public id: string) {
    }

    addPlayerToRoom(player: Player) {
        if (this.playerA == null) {
            this.playerA = player
        } else if (this.playerB == null) {
            this.playerB = player
        } else {
            throw "The room is already full"
        }

        this.allPlayers.push(player)
        player.socket.join(this.id)
        player.socket.on("disconnect", () => this.removePlayerFromRoom(player))
        player.socket.on("move-tile", (event: TileMoveEvent) => this.game.handleTileMove(player, event))

        console.log(`${player.username} joined room ${this.id}`)
    }

    removePlayerFromRoom(player: Player) {
        if (this.playerA == player) {
            this.playerA = null
        } else if (this.playerB == player) {
            this.playerB = null
        } else {
            throw "The player isn't inside the room"
        }

        this.allPlayers.splice(this.allPlayers.indexOf(player), 1)
        player.socket.leave(this.id)

        console.log(`${player.username} left room ${this.id}`)
    }

    isFull(): boolean {
        return this.playerA != null && this.playerB != null
    }

    isUsernameTaken(username: string): boolean {
        return this.allPlayers.some(it => it.username == username)
    }
}