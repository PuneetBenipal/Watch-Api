class SocketEmitter {
    constructor(io) {
        this.io = io;
        this.users = {};
    }

    emit(event, data) {
        this.io.emit(event, data);
    }

    addUser(socket, userId) {
        this.users[userId] = socket;
    }

    removeUser(userId) {
        delete this.users[userId];
    }

    getUserSocket(userId) {
        return this.users[userId]
    }

    getAllUsers() {
        return Object.keys(this.users)
    }

    sendEventToUser(event, userId, message) {
        const socket = this.getUserSocket(userId);
        if (socket) {
            socket.emit(event, message);
        }
    }
}

module.exports = SocketEmitter