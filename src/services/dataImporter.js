import csv from 'csvtojson'
const sheets = ['Cenotes', 'Sistemas', 'Connections', 'Access', 'Accessibility', 'Sources', 'Areas', 'Sistema colors']

const key = '1ylCUghFn4W_wNFAM9LnhFx-zDp4oVvWJ4RUh_mtDGwc'

// ['Cenotes!A1:AJ', 'Sistemas!A1:U', 'Old sistemas!A1:N', 'Accessibility!A1:D', 'Sources!A1:D', 'Areas!A1:C']
//https://docs.google.com/spreadsheets/d/{key}/gviz/tq?tqx=out:csv&sheet={sheet_name}


const RANGES_NAMES = ['caves', 'sistemas', 'connections', 'access', 'accessibility', 'sources', 'areas', 'colors']

export function getCaveData() {

  const promises = []
  const data = {}

  RANGES_NAMES.forEach((newSheetName, i) => {
    promises.push(
      fetch(`https://docs.google.com/spreadsheets/d/${key}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheets[i])}`)
        .then(response => {
          return response.text()
        })
        .then(function (text) {
          // console.log(text)
          return csv()
            .fromString(text)
            .then(sheetData => {
              // console.log(data)
              data[newSheetName] = sheetData
            })
        })
      // .catch(error => {
      //   reject(error)
      // })
    )
    // promises.push(
    //   new Promise((resolve, reject) => {
    //     Papa.parse(`https://docs.google.com/spreadsheets/d/${key}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheets[i])}`, {
    //       download: true,
    //       header: true,
    //       complete: result => {
    //         data[newSheetName] = result.data
    //         resolve()
    //       },
    //       error: (error, file) => reject(error)
    //     })
    //   }))
  })

  return Promise.all(promises).then(() => data)
}