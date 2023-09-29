import { useEffect } from 'react'
import { useTheme } from '@mui/material'

export default function Splash() {
  const theme = useTheme()
  const splashLength = 100
  const v = `v${process.env.REACT_APP_VERSION}`
  const splash = ` ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ █████╗ ██╗   ██╗███████╗███████╗    ██████╗ ██████╗  ██████╗ 
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██║   ██║██╔════╝██╔════╝   ██╔═══██╗██╔══██╗██╔════╝ 
██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ███████║██║   ██║█████╗  ███████╗   ██║   ██║██████╔╝██║  ███╗
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██╔══██║╚██╗ ██╔╝██╔══╝  ╚════██║   ██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗██║  ██║ ╚████╔╝ ███████╗███████║██╗╚██████╔╝██║  ██║╚██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ `

  const style = `
    color: ${theme.palette.primary.main};
  `
  useEffect(() => {
    console.log(`%c
${splash}
${v.padStart((splashLength + v.length) / 2, ' ')}
`, style)
  }, [])

  return undefined
}