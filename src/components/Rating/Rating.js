import { Rating } from '@mui/material'
import { Star } from '@mui/icons-material'
import './Rating.scss'

export default function OCRating(props) {
  return (
    <Rating
      name='cave-rating'
      value={props.value}
      size='small'
      className='rating'
      emptyIcon={<Star fontSize='inherit' />}
      readOnly />
  )
}