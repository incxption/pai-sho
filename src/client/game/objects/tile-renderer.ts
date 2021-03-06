import RenderObject from "./render-object.js";
import { LotusTile, Tile } from "../../../shared/logic/tiles.js";
import { add } from "../../../shared/utils/point.js";
import { gameBoardRenderer } from "../render-core.js";
import { ctx } from "../game.js";
import { scale, selectedSize, tileShadowOffset, tileSize } from "../../../shared/utils/dimensions.js";
import { isInCheck } from "../logic/whose-turn-is-it.js";

export default class TileRenderer extends RenderObject {

    public imageElement: HTMLImageElement = document.getElementById(this.tile.isDark
        ? this.tile.imageResource + "__dark"
        : this.tile.imageResource) as HTMLImageElement

    constructor(public tile: Tile) {
        super();
    }

    render = (): void => {
        if (this.tile.isThrown || this.tile.field == undefined) return

        const renderSize = this.tile.isClicked ? selectedSize : tileSize
        let { x, y } = add(gameBoardRenderer.center, this.tile.field.translateToPoint()!!)

        const cornerX = x - renderSize / 2
        const cornerY = y - renderSize / 2
        const shadowOffset = this.tile.isClicked ? 2 * tileShadowOffset : tileShadowOffset

        ctx.fillStyle = "rgba(0,0,0,.7)"
        ctx.beginPath()
        ctx.arc(x + shadowOffset, y + 2 * shadowOffset, renderSize / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.closePath()

        this.renderTileImage(cornerX, cornerY, renderSize)

        if (this.tile.isClicked || this.tile.isHovered) {
            ctx.fillStyle = this.tile.isClicked ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.15)"
            ctx.beginPath()
            ctx.arc(x, y, renderSize / 2, 0, Math.PI * 2)
            ctx.fill()
        }

        if (this.tile instanceof LotusTile && !this.tile.isDark && isInCheck()) {
            ctx.strokeStyle = "#ed1916"
            ctx.lineWidth = 2 * scale
            ctx.beginPath()
            ctx.arc(x, y, renderSize / 2 - (2 * scale), 0, Math.PI * 2)
            ctx.stroke()
        }
    };

    renderTileImage(x: number, y: number, size: number) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(this.imageElement, x, y, size, size)
    }

    requiresDefer = () => this.tile.isClicked
}