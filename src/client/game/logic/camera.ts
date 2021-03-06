import { canvas, draw, setCanvasDimensions } from "../game.js";
import { hoveredTile } from "./tile-interaction.js";
import { gameBoardRadius, scale } from "../../../shared/utils/dimensions.js";
import Animation from "../utils/animation.js";

let isShifting: boolean = false

export let targetLevel = 100
export let zoomLevel = 100
export let offsetX = 0
export let offsetY = 0

let zoomAnimation: Animation | null = null

function zoom(value: number) {
    targetLevel = Math.min(Math.max(targetLevel + value, 100), 250)
    zoomAnimation = new Animation(
        zoomAnimation?.stop() ?? zoomLevel,
        targetLevel,
        Math.abs(targetLevel - zoomLevel) / 30,
        1
    ).withCallback((value) => {
        zoomLevel = value
        setCanvasDimensions()
    }).start()
}

const background = document.getElementById("background-image") as HTMLImageElement

export function shift(x: number, y: number) {
    offsetX += x
    offsetY += y

    const minOffsetX = -canvas.width / 2 * scale + gameBoardRadius / scale;
    const maxOffsetX = canvas.width / 2 * scale - gameBoardRadius / scale;
    offsetX = Math.max(Math.min(offsetX, maxOffsetX), minOffsetX)

    const minOffsetY = -canvas.height / 2 * scale + gameBoardRadius / scale;
    const maxOffsetY = canvas.height / 2 * scale - gameBoardRadius / scale;
    offsetY = Math.max(Math.min(offsetY, maxOffsetY), minOffsetY)

    const ratio = background.naturalWidth / background.naturalHeight
    let bgWidth = window.innerWidth + (2 * maxOffsetX)
    let bgHeight = window.innerHeight + (2 * maxOffsetY)

    if (bgWidth > bgHeight) {
        bgHeight = (1/ratio) * bgWidth
    } else {
        bgWidth = ratio * bgHeight
    }

    const bgOverflowX = (bgWidth - window.innerWidth) / 2
    const bgOverflowY = (bgHeight - window.innerHeight) / 2

    background.width = bgWidth
    background.height = bgHeight

    background.style.left = `${-bgOverflowX + offsetX * 0.9}px`
    background.style.top = `${-bgOverflowY + offsetY * 0.9}px`

    draw()
}

export function createCameraListeners() {
    canvas.addEventListener("wheel", updateZoom)

    canvas.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("mousemove", updatePosition)
}

function updateZoom(event: WheelEvent) {
    event.preventDefault()
    event.stopPropagation()

    const amount = event.deltaY < 0 ? 20 : -20
    zoom(amount)
}

function updatePosition(event: MouseEvent) {
    if (isShifting) {
        shift(event.movementX * 0.8, event.movementY * 0.8)
    }
}

function onMouseDown(event: MouseEvent) {
    if (event.button != 0) return
    if (hoveredTile == null) {
        isShifting = true
    }
}

function onMouseUp(event: MouseEvent) {
    if (event.button != 0) return
    isShifting = false
}