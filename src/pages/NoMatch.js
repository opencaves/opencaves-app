import Grid from '@mui/material/Unstable_Grid2'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@mui/material'
import './NoMatch.scss'

export default function NoMatch({ match }) {
  const { t } = useTranslation('404')

  return (
    <Grid
      container
      className='no-match--container'
      direction='column'
      height='100vh'
      justifyContent='center'
      alignItems='center'
    >
      <Grid
        className='no-match--box'
      >
        <h1 className='no-match--header'>{t('header')}</h1>
        <p>{t('description')}</p>
        <Button
          component={Link}
          variant='contained'
          disableElevation
          to='/'
        >
          {t('backBtn')}
        </Button>
      </Grid>
    </Grid>
  )
}