import { Rating } from '@mui/material'
import { Star } from '@mui/icons-material'
import './Rating.scss'

export default function OCRating({ value, ...props }) {
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