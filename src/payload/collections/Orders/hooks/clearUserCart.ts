import type { CollectionAfterChangeHook } from 'payload'

import type { Order } from '../../../../payload-types'

export const clearUserCart: CollectionAfterChangeHook<Order> = async ({ doc, operation, req }) => {
  const { payload } = req

  if (operation === 'create' && doc.orderedBy) {
    const orderedBy = typeof doc.orderedBy === 'object' ? doc.orderedBy.id : doc.orderedBy

    const user = await payload.findByID({
      id: orderedBy,
      collection: 'users',
    })

    if (user) {
      await payload.update({
        id: orderedBy,
        collection: 'users',
        data: {
          cart: {
            items: [],
          },
        },
      })
    }
  }

  return
}
