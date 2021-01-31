import GameBoard from "../shared/logic/game-board.js";
import { buildLineup } from "./logic/lineup.js";
import { createHintRenderer, createTileListeners } from "./logic/tile-interaction.js"

export const gameBoard = new GameBoard()

export function initLogic() {
    console.log("[Logic] Pai Sho game logic initialized")
    gameBoard.loadFields()

    buildLineup()
    createTileListeners()
    createHintRenderer()
}