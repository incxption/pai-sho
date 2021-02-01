import DebugGameOverview from "../objects/debug-game-overview.js";
import { draw } from "../game.js";
import Field from "../../shared/logic/field.js";
import { gameBoard } from "../logic-core.js";
import { emitPassChainJump } from "../client-core.js";
import { LotusTile, Tile } from "../../shared/logic/tiles.js";
import { GameStartPacket } from "../../shared/events/game-start.js";
import { WhoseTurnPacket } from "../../shared/events/whose-turn.js";
import { InCheckPacket } from "../../shared/events/in-check.js";

const passButton = document.getElementById("pass-chain-jump") as HTMLButtonElement
passButton.addEventListener("click", () => emitPassChainJump())

let myTurn: boolean | null = null
let inCheck: boolean = false

let chainJumps: Field[] | null = null
let tileWhichChainJumps: string | null = null

export function isMyTurn(): boolean {
    return myTurn!!
}

export function isInCheck(): boolean {
    return inCheck
}

export function setIsMyTurn(packet: WhoseTurnPacket | GameStartPacket, isGameStart: boolean = false) {
    if (myTurn == packet.myTurn && myTurn && !isGameStart) {
        const wte = packet as WhoseTurnPacket;
        showPlayAgain()

        chainJumps = wte.chainJumps!!.map(obj => gameBoard.getField(obj.x, obj.y)!!)
        tileWhichChainJumps = wte.tileWhichChainJumps!!
        passButton.style.opacity = "1"
    } else {
        myTurn = packet.myTurn

        chainJumps = null
        tileWhichChainJumps = null
        passButton.style.opacity = "0"

        DebugGameOverview.getInstance().state.myTurn = myTurn
        draw()
    }
}

export function setInCheck(packet: InCheckPacket) {
    inCheck = packet.inCheck
}

export function verify(tile: Tile, field: Field): boolean {
    return verifyChainJumps(tile, field) && verifyCheck(tile, field)
}

/**
 * If the player is allowed to perform a chain-jump, this function makes sure that
 * the given field is a potential target of such a chain-jump. If no chain-jumps
 * are available, this function returns true for all fields.
 */
function verifyChainJumps(tile: Tile, field: Field): boolean {
    return chainJumps == null || (chainJumps.some(cj => field.equals(cj)) && tile.id == tileWhichChainJumps)
}

/**
 * If the player is in check, this function forces the player to move the lotus
 * tile out of check.
 */
function verifyCheck(tile: Tile, field: Field): boolean {
    if (!isInCheck()) return true
    return tile instanceof LotusTile && !field.wouldBeInCheck(tile)
}

function showPlayAgain() {
    console.log("You can play again!")
}