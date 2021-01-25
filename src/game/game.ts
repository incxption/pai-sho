import { renderCanvas } from "./render-core.js";

export const canvas = document.getElementById("main-canvas") as HTMLCanvasElement
export const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!!

window.addEventListener("resize", () => setCanvasDimensions())
setCanvasDimensions()
draw()

function draw() {
    ctx.fillStyle = "rgb(30, 30, 30)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    renderCanvas()
}

function setCanvasDimensions() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    console.log("== Updated canvas dimensions ==")
    console.log("canvas.width =", canvas.width)
    console.log("canvas.height =", canvas.height)

    draw()
}