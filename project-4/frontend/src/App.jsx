import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

// Set VITE_API_URL in Amplify (App settings > Environment variables). No trailing slash.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const PRODUCT_URL = `${API_URL}/product`

async function request(url, options = {}) {
  const headers = options.body ? { 'Content-Type': 'application/json' } : {}
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`)
  }
  return data
}

// The getProduct Lambda returns the raw DynamoDB response:
//   all items -> { Items: [...] }    one item -> { Item: {...} }
// This also copes with a plain array / object in case the response shape changes.
function toList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.Items)) return data.Items
  return []
}

function toItem(data) {
  return data?.Item ?? data ?? null
}

const emptyForm = { productId: '', name: '', price: '', available: false }

export default function App() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', price: '', available: false })
  const [detail, setDetail] = useState(null)

  const loadProducts = async () => {
    try {
      setError('')
      const data = await request(PRODUCT_URL)
      setProducts(toList(data))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!API_URL) {
      setLoading(false)
      return
    }
    loadProducts()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    const productId = form.productId.trim()
    const name = form.name.trim()
    const price = Number(form.price)

    if (!productId || !name || !price) {
      setError('Enter a product ID, a name, and a price above 0.')
      return
    }

    try {
      setSaving(true)
      setError('')
      await request(PRODUCT_URL, {
        method: 'POST',
        body: JSON.stringify({ productId, name, price, available: form.available }),
      })
      setForm(emptyForm)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (product) => {
    setEditingId(product.productId)
    setEditForm({
      name: product.name ?? '',
      price: product.price ?? '',
      available: Boolean(product.available),
    })
  }

  const handleUpdate = async (productId) => {
    const name = editForm.name.trim()
    const price = Number(editForm.price)

    if (!name || !price) {
      setError('Enter a name and a price above 0.')
      return
    }

    try {
      setError('')
      await request(`${PRODUCT_URL}/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        body: JSON.stringify({ name, price, available: editForm.available }),
      })
      setEditingId(null)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (productId) => {
    try {
      setError('')
      await request(`${PRODUCT_URL}/${encodeURIComponent(productId)}`, { method: 'DELETE' })
      if (detail?.productId === productId) setDetail(null)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDetails = async (productId) => {
    if (detail?.productId === productId) {
      setDetail(null)
      return
    }
    try {
      setError('')
      const data = await request(`${PRODUCT_URL}/${encodeURIComponent(productId)}`)
      setDetail(toItem(data))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="app">
      <h1>Product Inventory</h1>

      {!API_URL && (
        <p className="message error">
          VITE_API_URL is not set. Add it in Amplify under App settings &gt; Environment variables,
          then redeploy.
        </p>
      )}
      {error && <p className="message error">{error}</p>}

      <form className="product-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Product ID"
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm({ ...form, available: e.target.checked })}
          />
          Available
        </label>
        <button type="submit" className="primary" disabled={saving}>
          Add Product
        </button>
      </form>

      {loading && <p>Loading product...</p>}
      {!loading && API_URL && products.length === 0 && !error && (
        <p>No product yet. Add your first item above.</p>
      )}

      <div className="product-list">
        {products.map((product) => (
          <div className="product-card" key={product.productId}>
            {editingId === product.productId ? (
              <div className="edit-form">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editForm.available}
                    onChange={(e) => setEditForm({ ...editForm, available: e.target.checked })}
                  />
                  Available
                </label>
                <div className="actions">
                  <button className="primary small" onClick={() => handleUpdate(product.productId)}>
                    Save
                  </button>
                  <button className="secondary small" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3>{product.name}</h3>
                <img src={reactLogo} alt="" className="logo" />
                <p>Price: ${product.price}</p>
                <p>{product.available ? 'Available' : 'Not Available'}</p>

                {detail?.productId === product.productId && (
                  <p className="detail">ID: {detail.productId}</p>
                )}

                <div className="actions">
                  <button className="secondary small" onClick={() => handleDetails(product.productId)}>
                    {detail?.productId === product.productId ? 'Hide' : 'Details'}
                  </button>
                  <button className="primary small" onClick={() => startEdit(product)}>
                    Edit
                  </button>
                  <button className="danger small" onClick={() => handleDelete(product.productId)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
