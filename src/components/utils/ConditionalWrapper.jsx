/**
 * Its children, wrapped by `wrapper` when `condition` holds.
 *
 * @template {import('react').ReactNode} T
 * @param {object} props
 * @param {boolean} props.condition
 * @param {(children: T) => import('react').ReactNode} props.wrapper
 * @param {T} props.children
 * @returns {import('react').ReactNode}
 */
export default function ConditionalWrapper({ condition, wrapper, children }) {
  return condition ? wrapper(children) : children
}