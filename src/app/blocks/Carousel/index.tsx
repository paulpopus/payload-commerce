import type { Media, Product } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayloadHMR } from '@payloadcms/next/utilities'
import Link from 'next/link'
import React from 'react'

import type { CarouselBlockProps } from './types'

import { GridTileImage } from '../../components/grid/tile'

export const CarouselBlock: React.FC<
  CarouselBlockProps & {
    id?: string
  }
> = async (props) => {
  const { id, categories, limit = 3, populateBy, selectedDocs } = props

  let products: Product[] = []

  if (populateBy === 'collection') {
    const payload = await getPayloadHMR({ config: configPromise })

    const flattenedCategories = categories?.length
      ? categories.map((category) => {
          if (typeof category === 'string') return category
          else return category.id
        })
      : null

    const fetchedProducts = await payload.find({
      collection: 'products',
      depth: 1,
      limit,
      ...(flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    })

    products = fetchedProducts.docs
  } else {
    products = selectedDocs.map((post) => {
      if (typeof post.value !== 'string') return post.value
    })
  }

  if (!products?.length) return null

  // Purposefully duplicating products to make the carousel loop and not run out of products on wide screens.
  const carouselProducts = [...products, ...products, ...products]

  return (
    <div className=" w-full overflow-x-auto pb-6 pt-1">
      <ul className="flex animate-carousel gap-4">
        {carouselProducts.map((product, i) => (
          <li
            className="relative aspect-square h-[30vh] max-h-[275px] w-2/3 max-w-[475px] flex-none md:w-1/3"
            key={`${product.slug}${i}`}
          >
            <Link className="relative h-full w-full" href={`/product/${product.slug}`}>
              <GridTileImage
                label={{
                  amount: product.price,
                  currencyCode: product.currency,
                  title: product.title,
                }}
                media={product.meta.image as Media}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
