import pkg from '../../package.json'

const v = `v${pkg.version}`

console.log(`
 ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ █████╗ ██╗   ██╗███████╗███████╗    ██████╗ ██████╗  ██████╗ 
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██║   ██║██╔════╝██╔════╝   ██╔═══██╗██╔══██╗██╔════╝ 
██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ███████║██║   ██║█████╗  ███████╗   ██║   ██║██████╔╝██║  ███╗
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██╔══██║╚██╗ ██╔╝██╔══╝  ╚════██║   ██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗██║  ██║ ╚████╔╝ ███████╗███████║██╗╚██████╔╝██║  ██║╚██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ 
${v.padStart((106 - v.length) / 2, ' ')}                                                             

`)