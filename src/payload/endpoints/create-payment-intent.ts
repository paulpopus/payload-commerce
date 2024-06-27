import type { InfoType } from '@/payload/collections/Products/ui/types'
import type { User } from '@/payload-types'
import type { PayloadHandler, PayloadRequestWithData } from 'payload'

import { addDataAndFileToRequest } from '@payloadcms/next/utilities'
import Stripe from 'stripe'

import type { CartItems } from '../../payload-types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-08-01',
})

// this endpoint creates an `Invoice` with the items in the cart
// to do this, we loop through the items in the cart and lookup the product in Stripe
// we then add the price of the product to the total
// once completed, we pass the `client_secret` of the `PaymentIntent` back to the client which can process the payment
export const createPaymentIntent: PayloadHandler = async (req) => {
  const { payload, user } = req

  await addDataAndFileToRequest({ request: req })
  console.log({ data: (req as PayloadRequestWithData).data })
  const cartFromRequest = (req as PayloadRequestWithData).data?.cart
  const emailFromRequest = (req as PayloadRequestWithData).data?.email

  if (!user && !emailFromRequest) {
    return Response.json('A user or an email is required for this transaction.', { status: 401 })
  }

  let fullUser: User | undefined

  if (user) {
    fullUser = await payload.findByID({
      id: user?.id,
      collection: 'users',
    })
  }

  const cart = fullUser?.cart.items || (cartFromRequest as { items: CartItems }).items

  if (!cart && cart?.length > 0) {
    return Response.json(
      { error: 'Please provide a cart either directly or from the user.' },
      { status: 401 },
    )
  }

  try {
    let stripeCustomerID = fullUser?.stripeCustomerID
    let stripeCustomer: Stripe.Customer | undefined

    // If the user is logged in and has a Stripe Customer ID, use that
    if (fullUser) {
      if (!stripeCustomerID) {
        // lookup user in Stripe and create one if not found

        const customer = (
          await stripe.customers.list({
            email: fullUser.email,
          })
        ).data?.[0]

        // Create a new customer if one is not found
        if (!customer) {
          // lookup user in Stripe and create one if not found
          const customer = await stripe.customers.create({
            name: fullUser?.name,
            email: fullUser.email,
          })

          stripeCustomerID = customer.id
        } else {
          stripeCustomerID = customer.id
        }

        await payload.update({
          id: user?.id,
          collection: 'users',
          data: {
            stripeCustomerID,
          },
        })
      }
      // Otherwise use the email from the request to lookup the user in Stripe
    } else {
      // lookup user in Stripe and create one if not found
      const customer = (
        await stripe.customers.list({
          email: emailFromRequest as string,
        })
      ).data?.[0]

      // Create a new customer if one is not found
      if (!customer) {
        const customer = await stripe.customers.create({
          email: emailFromRequest as string,
        })

        stripeCustomer = customer
        stripeCustomerID = customer.id
      } else {
        stripeCustomer = customer
        stripeCustomerID = customer.id
      }
    }

    let total = 0

    const metadata = []

    // for each item in cart, lookup the product in Stripe and add its price to the total
    await Promise.all(
      cart?.map(async (item) => {
        const { product, quantity, variant: variantFromItem } = item

        const isVariant = Boolean(variantFromItem)

        if (!quantity) {
          return null
        }

        if (typeof product === 'string') {
          return null
        }

        let price = 0

        if (isVariant) {
          const variant = product.variants.variants.find((item) => item.id === variantFromItem)

          if (variant) {
            price = (variant.info as InfoType).price.amount
          }
        } else {
          price = (product.info as InfoType).price.amount
        }

        metadata.push({
          product: product.id,
          quantity,
          variant: variantFromItem,
        })

        total += price * quantity

        return null
      }),
    )

    if (total === 0) {
      throw new Error('There is nothing to pay for, add some items to your cart and try again.')
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      customer: stripeCustomerID,
      metadata: {
        cart: JSON.stringify(metadata),
      },
      payment_method_types: ['card'],
    })

    return Response.json({ client_secret: paymentIntent.client_secret }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    payload.logger.error(message)

    return Response.json({ error: message }, { status: 401 })
  }
}
