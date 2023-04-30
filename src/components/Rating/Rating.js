import { Rating } from '@mui/material'
import './Rating.scss'

export default function OCRating(props) {
  return (
    <Rating name='cave-rating' value={props.value} size='small' className='rating' readOnly></Rating>
  )
}