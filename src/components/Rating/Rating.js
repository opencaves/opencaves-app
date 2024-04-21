import { useEffect, useState } from 'react'
import { Rating } from '@mui/material'
import { Star } from '@mui/icons-material'
import { getByCaveId } from '@/models/Rating'
import './Rating.scss'

export default function OCRating({ caveId, ...props }) {
  const [value, setValue] = useState(null)

  useEffect(() => {
    async function getRating() {
      const rating = await getByCaveId(caveId)
      setValue(rating.value)
    }
    getRating()
  }, [caveId])

  return (
    <Rating
      {...props}
      name='cave-rating'
      value={value}
      size='small'
      className='rating'
      emptyIcon={<Star fontSize='inherit' />}
      readOnly />
  )
}