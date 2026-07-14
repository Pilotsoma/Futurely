import { prisma } from './prisma'
import { logger } from '../common/logger'
import { sendToUser } from './websocket'

export interface CreateNotificationInput {
  userId: number
  fromUserId: number
  type: string
  preview?: string
  postId?: number
}

/**
 * Creates a Notification row and pushes it to the recipient over WebSocket.
 * Never throws — failures are logged via the structured logger and swallowed
 * so callers do not need to wrap this in try/catch.
 */
export async function createAndSendNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: input.userId,
        fromUserId: input.fromUserId,
        type: input.type,
        preview: input.preview,
        postId: input.postId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            tag: true,
            tagColor: true,
            nameColor: true,
            avatarUrl: true,
          },
        },
      },
    })
    sendToUser(input.userId, 'NOTIFICATION', notif)
  } catch (err) {
    logger.error('createAndSendNotification_failed', {
      userId: input.userId,
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
