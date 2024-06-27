import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { Media } from '@/components/Media'
import Price from '@/components/price'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getMeUser } from '@/utilities/getMeUser'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { Fragment } from 'react'

export default async function Order({
  params: { id },
  searchParams,
}: {
  params: { id: string }
  searchParams: { paymentId?: string }
}) {
  const { token } =
    await getMeUser(/* {
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to view this order.',
    )}&redirect=${encodeURIComponent(`/order/${id}`)}`,
    } */)

  const paymentId = searchParams.paymentId ?? ''

  let order: Order | null = null

  try {
    order = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/orders/${id}?where=[stripePaymentIntentID][equals]=${paymentId}`,
      {
        headers: {
          ...(token
            ? {
                Authorization: `JWT ${token}`,
              }
            : {}),
          'Content-Type': 'application/json',
        },
      },
    )?.then(async (res) => {
      if (!res.ok) notFound()
      const json = await res.json()
      if ('error' in json && json.error) notFound()
      if ('errors' in json && json.errors) notFound()
      return json
    })
  } catch (error) {
    console.error(error) // eslint-disable-line no-console
  }

  if (!order) {
    notFound()
  }

  return (
    <div className="container my-16">
      {token && (
        <div className="flex gap-4">
          <Button asChild variant="default">
            <Link href="/orders">See all orders</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account">Go to account</Link>
          </Button>
        </div>
      )}
      <hr className="my-8" />
      <div className="prose dark:prose-invert">
        <h1>
          <span className="">{`Order #${order.id}`}</span>
        </h1>
      </div>
      <div className="">
        <p>
          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
        </p>
        <p className="">
          {'Total: '}
          {new Intl.NumberFormat('en-US', {
            currency: 'usd',
            style: 'currency',
          }).format(order.total / 100)}
        </p>
      </div>
      <hr />
      <div className="">
        <h4 className="">Items</h4>
        {order.items?.map((item, index) => {
          if (typeof item.product === 'object') {
            const {
              product,
              product: { id, meta, stripeProductID, title },
              quantity,
            } = item

            const isLast = index === (order?.items?.length || 0) - 1

            const metaImage = meta?.image

            return (
              <Fragment key={index}>
                <div className="">
                  <Link className="relative" href={`/products/${product.slug}`}>
                    {!metaImage && <span className="">No image</span>}
                    {metaImage && typeof metaImage !== 'string' && (
                      <Media className="" fill imgClassName="" resource={metaImage} />
                    )}
                  </Link>
                  <div className="">
                    {!stripeProductID && (
                      <p className="">
                        {'This product is not yet connected to Stripe. To link this product, '}
                        <Link
                          href={`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/collections/products/${id}`}
                        >
                          edit this product in the admin panel
                        </Link>
                        .
                      </p>
                    )}
                    <h5 className="">
                      <Link className="" href={`/products/${product.slug}`}>
                        {title}
                      </Link>
                    </h5>
                    <p>{`Quantity: ${quantity}`}</p>
                    {/* <Price button={false} product={product} quantity={quantity} /> */}
                  </div>
                </div>
                {!isLast && <hr />}
              </Fragment>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

export async function generateMetadata({ params: { id } }): Promise<Metadata> {
  return {
    description: `Order details for order ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Order ${id}`,
      url: `/orders/${id}`,
    }),
    title: `Order ${id}`,
  }
}
