import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="mb-2 text-xl font-semibold text-fg">Page not found</h1>
      <Link to="/" className="font-semibold text-accent">Back to Today</Link>
    </div>
  )
}

export default NotFound
