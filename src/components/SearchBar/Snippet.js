import { useTranslation } from 'react-i18next'
import { Typography, styled } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'

const SnippetTextPrimary = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.secondary
}
))

const SnippetTextSecondary = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.vars.palette.text.secondary
}
))

export default function Snippet({ result }) {
  const { t } = useTranslation('searchBar')

  if (result.hints.name) {
    return (
      <Grid container>
        <Grid xs>
          <SnippetTextPrimary dangerouslySetInnerHTML={{ __html: result.hints.name }} />
        </Grid>
        <Grid>
          <SnippetTextSecondary>{result.area}</SnippetTextSecondary>
        </Grid>
      </Grid>
    )
  }

  const prop = Object.keys(result.hints)[0]
  if (prop) {
    const value = result.hints[prop]
    return <>
      <Grid container>
        <Grid xs>
          <SnippetTextPrimary>{result.name}</SnippetTextPrimary>
        </Grid>
        <Grid>
          <SnippetTextSecondary
            component='span'
          >{result.area}</SnippetTextSecondary>
        </Grid>
      </Grid>
      <SnippetTextSecondary
        component='div'
        sx={{
          mt: '1px'
        }}
        className='oc-search-bar--results-item-extra'>
        <span dangerouslySetInnerHTML={{ __html: Array.isArray(value) ? value[0] : value }}></span>
        <span> </span>
        <span>({t(`snippet.${prop}`)})</span>
      </SnippetTextSecondary>
    </>
  }
  return (
    <Grid container>
      <Grid xs>
        <SnippetTextPrimary>{result.name}</SnippetTextPrimary>
      </Grid>
      <Grid>
        <SnippetTextSecondary
          component='span'
        >{result.area}</SnippetTextSecondary>
      </Grid>
    </Grid>
  )
}
