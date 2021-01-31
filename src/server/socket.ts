import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http"
import { JoinRoomEvent } from "../shared/events/room-events.js";
import { RoomManager } from "./room/room-manager.js";
import joinRoom = RoomManager.joinRoom;

export let serverIO: Server

export function attachSocketServer(http: HttpServer) {
    serverIO = new Server(http)

    serverIO.on("connection", (socket: Socket) => {
        socket.on("join-room", (event: JoinRoomEvent) => {
            if (!joinRoom(socket, event)) {
                socket.emit("<-join-room", { success: false })
            }
        })
    })
}