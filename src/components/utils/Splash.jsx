import { useEffect } from 'react'
import { useTheme } from '@mui/material'

export default function Splash() {
  const theme = useTheme()
  const splashLength = 100
  const v = `v${import.meta.env.REACT_APP_VERSION}`
  const splash = ` ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ █████╗ ██╗   ██╗███████╗███████╗    ██████╗ ██████╗  ██████╗ 
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██║   ██║██╔════╝██╔════╝   ██╔═══██╗██╔══██╗██╔════╝ 
██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ███████║██║   ██║█████╗  ███████╗   ██║   ██║██████╔╝██║  ███╗
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██╔══██║╚██╗ ██╔╝██╔══╝  ╚════██║   ██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗██║  ██║ ╚████╔╝ ███████╗███████║██╗╚██████╔╝██║  ██║╚██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ `

  const primaryColor = theme.palette.primary.main
  const style = `
    color: ${primaryColor};
  `
  useEffect(() => {
    console.log(
      `%c
${splash}
${v.padStart((splashLength + v.length) / 2, ' ')}
`,
      style,
    )
  }, [splash, splashLength, style, v])

  return undefined
}
