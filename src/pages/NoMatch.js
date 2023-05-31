

export default function NoMatch({ match }) {

  return (
    <div>
      <h3>
        No match for <code>{match.url}</code>
      </h3>
    </div>
  )
}