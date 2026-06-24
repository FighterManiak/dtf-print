import { Suspense } from 'react'
import OrderForm from '@/components/order/OrderForm'

export default function OrderPage() {
  return (
    <Suspense>
      <OrderForm />
    </Suspense>
  )
}
