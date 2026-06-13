# Real-time Chat with Socket.io

Full-stack real-time chat application with Socket.io, React, MongoDB, and Redis.

## Features

- Real-time messaging with Socket.io
- Chat rooms (public and private)
- Direct messages (DMs) between users
- Typing indicators
- Online presence / user status
- File sharing (images, documents)
- Message history with MongoDB
- Read receipts
- Emoji support
- Redis adapter for horizontal scaling
- React TypeScript frontend

## Architecture

```
+-------------------+        +--------------------+
|   React Client    |        |   React Client     |
|  (Socket.io-cli)  |        |  (Socket.io-cli)   |
+--------+----------+        +---------+----------+
         |                             |
         +-------------- +-+-----------+
                         |
              +----------v-----------+
              |   Express + Socket.io |
              |        Server         |
              +-----+--------+-------+
                    |        |
             +------v---+ +--v-------+
             | MongoDB  | |  Redis   |
             | Messages | | Adapter  |
             | Rooms    | | Presence |
             +----------+ +----------+
```

## Setup

### With Docker

```bash
git clone https://github.com/mzashah/realtime-chat-socketio
cd realtime-chat-socketio
cp .env.example .env
docker compose up --build
```

### Manual

```bash
# Server
cd server && npm install && npm start

# Client
cd client && npm install && npm start
```

## Socket Events

### Client -> Server
| Event           | Payload                              | Description           |
|-----------------|--------------------------------------|-----------------------|
| join-room       | { roomId }                           | Join a chat room      |
| leave-room      | { roomId }                           | Leave a chat room     |
| message         | { roomId, content, type }            | Send room message     |
| private-message | { recipientId, content }             | Send DM               |
| typing          | { roomId }                           | Start typing          |
| stop-typing     | { roomId }                           | Stop typing           |

### Server -> Client
| Event           | Payload                              | Description           |
|-----------------|--------------------------------------|-----------------------|
| message         | Message object                       | New room message      |
| private-message | Message object                       | New DM                |
| user-joined     | { userId, username }                 | User joined room      |
| user-left       | { userId, username }                 | User left room        |
| typing          | { userId, username, roomId }         | User typing           |
| stop-typing     | { userId, username, roomId }         | User stopped          |
| online-users    | string[]                             | Online user IDs       |

## Tech Stack

- **Backend:** Node.js, Express, Socket.io 4.x
- **Frontend:** React 18, TypeScript, Socket.io-client
- **Database:** MongoDB with Mongoose
- **Cache/PubSub:** Redis (Socket.io adapter)
- **Container:** Docker Compose

## License

MIT
