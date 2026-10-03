function noop() { }

const noopAsync = () => Promise.resolve(undefined)

export default noop
export { noop, noopAsync }

