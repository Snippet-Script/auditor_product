import React, { useCallback, useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { useNavigate } from 'react-router-dom'
import styles from './CanvasPOC.module.css'
import { rewriteWithAI } from '../../lib/ai'

interface ElementBase { id: string; x: number; y: number; w: number; h: number; type: 'text' | 'rect' | 'image'; rotation?: number }
interface TextElement extends ElementBase { type: 'text'; text: string; fontSize: number; color: string; fontWeight?: number; fontStyle?: 'normal' | 'italic'; underline?: boolean; fontFamily?: string; textAlign?: 'left' | 'center' | 'right' }
interface RectElement extends ElementBase { type: 'rect'; fill: string; radius: number }
interface ImageElement extends ElementBase { type: 'image'; src: string; fit: 'cover' | 'contain' }

type AnyEl = TextElement | RectElement | ImageElement

const createText = (): TextElement => ({
  id: crypto.randomUUID(), type: 'text', x: 100, y: 100, w: 280, h: 90, text: 'Double click to edit', fontSize: 32, color: '#222', fontWeight: 600, fontStyle: 'normal', underline: false, fontFamily: 'system-ui, sans-serif', textAlign: 'left'
})
const createRect = (): RectElement => ({ id: crypto.randomUUID(), type: 'rect', x: 80, y: 80, w: 300, h: 180, fill: '#2684ff', radius: 8 })
const createImage = (src: string): ImageElement => ({ id: crypto.randomUUID(), type: 'image', x: 120, y: 140, w: 360, h: 240, src, fit: 'cover' })

interface Page { id: string; name: string; elements: AnyEl[] }
const PAGES_KEY = 'canvas-poc-pages'
const ASSETS_KEY = 'canvas-poc-assets'

export default function CanvasPOC() {
  const navigate = useNavigate()
  const [pages, setPages] = useState<Page[]>(() => {
    try { const raw = localStorage.getItem(PAGES_KEY); if (raw) return JSON.parse(raw) as Page[] } catch {}
    return [{ id: crypto.randomUUID(), name: 'Page 1', elements: [createText()] }]
  })
  const [currentPage, setCurrentPage] = useState<string>(() => pages[0].id)
  const els = pages.find(p => p.id === currentPage)?.elements || []
  const [assets, setAssets] = useState<string[]>(() => { try { const raw = localStorage.getItem(ASSETS_KEY); if (raw) return JSON.parse(raw) } catch {}; return [] })
  const [selectedId, setSelected] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef<{ ox: number; oy: number; ex: number; ey: number } | null>(null)
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [scale, setScale] = useState(0.9)
  const [showGrid, setShowGrid] = useState(true)
  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)
  const [exportingPng, setExportingPng] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [toolbar, setToolbar] = useState<{x:number;y:number;visible:boolean}>({x:0,y:0,visible:false})
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiTone, setAiTone] = useState<string>('Concise')
  const [aiOutput, setAiOutput] = useState('')
  const [aiPos, setAiPos] = useState<{x:number;y:number}>({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)

  const selectEl = (id: string | null) => setSelected(id)
  const getEl = (id: string | null) => els.find(e => e.id === id)

  useEffect(() => { localStorage.setItem(PAGES_KEY, JSON.stringify(pages)) }, [pages])
  useEffect(() => { localStorage.setItem(ASSETS_KEY, JSON.stringify(assets)) }, [assets])

  const updateCurrent = (mutate: (elements: AnyEl[]) => AnyEl[]) => {
    setPages(ps => ps.map(p => p.id === currentPage ? { ...p, elements: mutate(p.elements) } : p))
  }

  const addText = () => { const t = createText(); updateCurrent(e => [...e, t]); selectEl(t.id) }
  const addRect = () => { const r = createRect(); updateCurrent(e => [...e, r]); selectEl(r.id) }
  const addImgUrl = () => { const url = prompt('Enter image URL'); if (!url) return; const img = createImage(url); updateCurrent(e => [...e, img]); selectEl(img.id) }
  const addImgAsset = (src: string) => { const img = createImage(src); updateCurrent(e => [...e, img]); selectEl(img.id) }
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onload = ev => { if (typeof ev.target?.result === 'string') setAssets(a => [...a, ev.target!.result as string]) }; reader.readAsDataURL(file)
    e.target.value = ''
  }

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    selectEl(id)
  const clicked = getEl(id)
  if (clicked && clicked.type === 'text') {
      setAiOpen(true)
    } else {
      setAiOpen(false)
    }
  const el = clicked; if (!el || !artboardRef.current) return
    const rect = artboardRef.current.getBoundingClientRect()
    const ex = el.x; const ey = el.y
    const ox = (e.clientX - rect.left) / scale - ex
    const oy = (e.clientY - rect.top) / scale - ey
    dragOffset.current = { ox, oy, ex, ey }
    setIsDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !selectedId || !artboardRef.current || !dragOffset.current) return
    const rect = artboardRef.current.getBoundingClientRect()
    const el = getEl(selectedId); if (!el) return
    const nx = (e.clientX - rect.left) / scale - dragOffset.current.ox
    const ny = (e.clientY - rect.top) / scale - dragOffset.current.oy
    const snapThreshold = 6
    let sx: number | null = null; let sy: number | null = null
    const movingWidth = el.w; const movingHeight = el.h
    const movingCenterX = nx + movingWidth / 2
    const movingCenterY = ny + movingHeight / 2
    const artCenterX = 794/2; const artCenterY = 1123/2
    let fx = nx; let fy = ny
    const consider = (candidate:number, target:number, setter:(v:number)=>void, axis:'x'|'y') => {
      if (Math.abs(candidate - target) <= snapThreshold) { setter(target); if(axis==='x') sx = target; else sy = target } }
    consider(movingCenterX, artCenterX, c => fx += (c - movingCenterX), 'x')
    consider(movingCenterY, artCenterY, c => fy += (c - movingCenterY), 'y')
    els.forEach(other => {
      if (other.id === selectedId) return
      const edgesX = [other.x, other.x + other.w/2, other.x + other.w]
      const edgesY = [other.y, other.y + other.h/2, other.y + other.h]
      edgesX.forEach(ex => {
        consider(nx, ex, () => { fx = ex }, 'x')
        consider(nx + movingWidth, ex, () => { fx = ex - movingWidth }, 'x')
        consider(movingCenterX, ex, c => fx += (c - movingCenterX), 'x')
      })
      edgesY.forEach(ey => {
        consider(ny, ey, () => { fy = ey }, 'y')
        consider(ny + movingHeight, ey, () => { fy = ey - movingHeight }, 'y')
        consider(movingCenterY, ey, c => fy += (c - movingCenterY), 'y')
      })
    })
    setGuideX(sx)
    setGuideY(sy)
    updateCurrent(list => list.map(item => item.id === selectedId ? { ...item, x: Math.round(fx), y: Math.round(fy) } : item))
  }
  const onPointerUp = () => { setIsDragging(false); dragOffset.current = null }

  const resizingId = useRef<string | null>(null)
  const resizeStart = useRef<{ w: number; h: number; x: number; y: number; ox: number; oy: number } | null>(null)
  const onResizeDown = (e: React.PointerEvent, id: string, corner: 'br') => {
    e.stopPropagation(); e.preventDefault()
    const el = getEl(id); if (!el || !artboardRef.current) return
    const rect = artboardRef.current.getBoundingClientRect()
    resizingId.current = id
    resizeStart.current = { w: el.w, h: el.h, x: el.x, y: el.y, ox: (e.clientX - rect.left), oy: (e.clientY - rect.top) }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeUp)
  }
  const onResizeMove = (e: PointerEvent) => {
    const id = resizingId.current; if (!id || !resizeStart.current || !artboardRef.current) return
    const st = resizeStart.current
    const rect = artboardRef.current.getBoundingClientRect()
    const dw = (e.clientX - rect.left) - st.ox
    const dh = (e.clientY - rect.top) - st.oy
    updateCurrent(list => list.map(el => el.id === id ? { ...el, w: Math.max(20, Math.round(st.w + dw / scale)), h: Math.max(20, Math.round(st.h + dh / scale)) } : el))
  }
  const onResizeUp = () => {
    resizingId.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeUp)
    setGuideX(null); setGuideY(null)
  }

  useEffect(() => () => { // cleanup
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeUp)
  }, [])

  const onTextEdit = (id: string, text: string) => updateCurrent(list => list.map(e => e.id === id ? { ...(e as TextElement), text } : e))
  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    updateCurrent(e => e.filter(x => x.id !== selectedId))
    selectEl(null)
  }, [selectedId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected() }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'd') {
          const el = getEl(selectedId); if (!el) return
          const clone: AnyEl = { ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }
          updateCurrent(l => [...l, clone]); selectEl(clone.id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, deleteSelected])

  const exportJSON = () => {
    setExporting(true)
  }
  const exportPNG = async () => {
    if (exportingPng) return
    setExportingPng(true)
    const canvas = document.createElement('canvas')
    canvas.width = 794; canvas.height = 1123
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height)
    const loadImage = (src:string) => new Promise<HTMLImageElement>((res,rej)=>{ const im = new Image(); im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=rej; im.src=src })
    for (const el of els) {
      if (el.type === 'rect') {
        const r = el as RectElement
        ctx.fillStyle = r.fill
        const radius = r.radius
        ctx.beginPath()
        const x = r.x; const y = r.y; const w = r.w; const h = r.h
        const rr = Math.min(radius, w/2, h/2)
        ctx.moveTo(x+rr,y)
        ctx.lineTo(x+w-rr,y)
        ctx.quadraticCurveTo(x+w,y,x+w,y+rr)
        ctx.lineTo(x+w,y+h-rr)
        ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h)
        ctx.lineTo(x+rr,y+h)
        ctx.quadraticCurveTo(x,y+h,x,y+h-rr)
        ctx.lineTo(x,y+rr)
        ctx.quadraticCurveTo(x,y,x+rr,y)
        ctx.closePath(); ctx.fill()
      } else if (el.type === 'text') {
        const t = el as TextElement
        ctx.fillStyle = t.color
        ctx.font = `${t.fontStyle === 'italic' ? 'italic ' : ''}${t.fontWeight || 400} ${t.fontSize}px ${t.fontFamily || 'system-ui, sans-serif'}`
        ctx.textBaseline = 'top'
        ctx.textAlign = t.textAlign || 'left'
        const lines = t.text.split(/\n/) 
        let cy = t.y
        const baseX = t.textAlign === 'center' ? t.x + t.w/2 : t.textAlign === 'right' ? t.x + t.w : t.x
        for (const line of lines) {
          ctx.fillText(line, baseX, cy)
          if (t.underline) { const m = ctx.measureText(line); const underlineY = cy + t.fontSize + Math.max(1, t.fontSize * 0.05); ctx.beginPath(); ctx.strokeStyle = t.color; ctx.lineWidth = Math.max(1, t.fontSize/16); const startX = baseX - (t.textAlign==='center'? m.width/2 : t.textAlign==='right'? m.width:0); ctx.moveTo(startX, underlineY); ctx.lineTo(startX + m.width, underlineY); ctx.stroke(); }
          cy += t.fontSize * 1.3
        }
      } else if (el.type === 'image') {
        const im = el as ImageElement
        try { const image = await loadImage(im.src); ctx.save(); if (im.fit === 'cover') {
          const scale = Math.max(im.w / image.width, im.h / image.height)
          const dw = image.width * scale; const dh = image.height * scale
          const dx = im.x + (im.w - dw)/2; const dy = im.y + (im.h - dh)/2
          ctx.drawImage(image, dx, dy, dw, dh)
        } else {
          const scale = Math.min(im.w / image.width, im.h / image.height)
          const dw = image.width * scale; const dh = image.height * scale
          const dx = im.x + (im.w - dw)/2; const dy = im.y + (im.h - dh)/2
          ctx.drawImage(image, dx, dy, dw, dh)
        } ctx.restore() } catch {}
      }
    }
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url; a.download = `${pages.find(p=>p.id===currentPage)?.name || 'page'}.png`
    a.click()
    setTimeout(()=> setExportingPng(false), 400)
  }

  const exportPDF = async () => {
    if (exportingPdf) return
    setExportingPdf(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 794; canvas.height = 1123
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height)
      const loadImage = (src:string) => new Promise<HTMLImageElement>((res,rej)=>{ const im = new Image(); im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=rej; im.src=src })
      for (const el of els) {
        if (el.type === 'rect') {
          const r = el as RectElement
          ctx.fillStyle = r.fill
          const radius = r.radius
          ctx.beginPath()
          const x = r.x; const y = r.y; const w = r.w; const h = r.h
          const rr = Math.min(radius, w/2, h/2)
          ctx.moveTo(x+rr,y)
          ctx.lineTo(x+w-rr,y)
          ctx.quadraticCurveTo(x+w,y,x+w,y+rr)
          ctx.lineTo(x+w,y+h-rr)
          ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h)
          ctx.lineTo(x+rr,y+h)
          ctx.quadraticCurveTo(x,y+h,x,y+h-rr)
          ctx.lineTo(x,y+rr)
          ctx.quadraticCurveTo(x,y,x+rr,y)
          ctx.closePath(); ctx.fill()
        } else if (el.type === 'text') {
          const t = el as TextElement
          ctx.fillStyle = t.color
          ctx.font = `${t.fontStyle === 'italic' ? 'italic ' : ''}${t.fontWeight || 400} ${t.fontSize}px ${t.fontFamily || 'system-ui, sans-serif'}`
          ctx.textBaseline = 'top'
          ctx.textAlign = t.textAlign || 'left'
          const lines = t.text.split(/\n/)
          let cy = t.y
          const baseX = t.textAlign === 'center' ? t.x + t.w/2 : t.textAlign === 'right' ? t.x + t.w : t.x
          for (const line of lines) {
            ctx.fillText(line, baseX, cy)
            if (t.underline) { const m = ctx.measureText(line); const underlineY = cy + t.fontSize + Math.max(1, t.fontSize * 0.05); ctx.beginPath(); ctx.strokeStyle = t.color; ctx.lineWidth = Math.max(1, t.fontSize/16); const startX = baseX - (t.textAlign==='center'? m.width/2 : t.textAlign==='right'? m.width:0); ctx.moveTo(startX, underlineY); ctx.lineTo(startX + m.width, underlineY); ctx.stroke(); }
            cy += t.fontSize * 1.3
          }
        } else if (el.type === 'image') {
          const im = el as ImageElement
          try { const image = await loadImage(im.src); ctx.save(); if (im.fit === 'cover') {
            const scale = Math.max(im.w / image.width, im.h / image.height)
            const dw = image.width * scale; const dh = image.height * scale
            const dx = im.x + (im.w - dw)/2; const dy = im.y + (im.h - dh)/2
            ctx.drawImage(image, dx, dy, dw, dh)
          } else {
            const scale = Math.min(im.w / image.width, im.h / image.height)
            const dw = image.width * scale; const dh = image.height * scale
            const dx = im.x + (im.w - dw)/2; const dy = im.y + (im.h - dh)/2
            ctx.drawImage(image, dx, dy, dw, dh)
          } ctx.restore() } catch {}
        }
      }
      const url = canvas.toDataURL('image/png')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      doc.addImage(url, 'PNG', 0, 0, pageW, pageH)
      doc.save(`${pages.find(p=>p.id===currentPage)?.name || 'page'}.pdf`)
    } finally {
      setTimeout(()=> setExportingPdf(false), 400)
    }
  }

  const json = JSON.stringify(els, null, 2)
  const zoomIn = () => setScale(s => Math.min(3, +(s + 0.1).toFixed(2)))
  const zoomOut = () => setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)))
  const resetZoom = () => setScale(0.9)
  const handleTextInput = (id: string, e: React.FormEvent<HTMLDivElement>) => {
    const txt = (e.target as HTMLDivElement).innerText.replace(/\n+/g, '\n')
    onTextEdit(id, txt)
  }
  const handleTextBlur = (id: string, e: React.FocusEvent<HTMLDivElement>) => {
    const txt = e.currentTarget.innerText.replace(/\n+/g, '\n')
    onTextEdit(id, txt)
    setEditingId(null)
  }
  const onArtboardWheel = (e: React.WheelEvent) => {
    // Zoom the A4 artboard under the cursor; prevent page scroll
    e.preventDefault()
    if (e.deltaY > 0) zoomOut(); else zoomIn()
  }
  const sel = getEl(selectedId)
  const updateSel = (patch: Partial<any>) => { if (!selectedId) return; updateCurrent(list => list.map(e => e.id === selectedId ? { ...e, ...patch } : e)) }
  const bringForward = () => { if (!selectedId) return; updateCurrent(list => { const idx = list.findIndex(e => e.id === selectedId); if (idx === -1 || idx === list.length - 1) return list; const copy=[...list]; const [el]=copy.splice(idx,1); copy.splice(idx+1,0,el); return copy }) }
  const sendBackward = () => { if (!selectedId) return; updateCurrent(list => { const idx = list.findIndex(e => e.id === selectedId); if (idx <= 0) return list; const copy=[...list]; const [el]=copy.splice(idx,1); copy.splice(idx-1,0,el); return copy }) }
  const duplicateSel = () => { if (!sel) return; const clone: AnyEl = { ...sel, id: crypto.randomUUID(), x: sel.x + 30, y: sel.y + 30 }; updateCurrent(l => [...l, clone]); setSelected(clone.id) }
  const addPage = () => {
    const pg: Page = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, elements: [] }
    setPages(p => {
      const idx = p.findIndex(x => x.id === currentPage)
      if (idx === -1) return [...p, pg]
      const copy = [...p]
      copy.splice(idx + 1, 0, pg)
      return copy
    })
    setCurrentPage(pg.id)
    setSelected(null)
  }
  const applyNewsletterTemplate = () => {
    const hero = createRect(); hero.x = 60; hero.y = 140; hero.w = 674; hero.h = 260; hero.fill = '#ececec'
    const title = createText(); title.text = 'Newsletter Title'; title.x = 60; title.y = 40; title.fontSize = 54; title.w = 650
    const subtitle = createText(); subtitle.text = 'Subtitle or tagline goes here'; subtitle.x = 60; subtitle.y = 105; subtitle.fontSize = 22; subtitle.w = 650; subtitle.fontWeight = 400
    const body = createText(); body.text = '• Point one\n• Point two\n• Point three'; body.x = 60; body.y = 430; body.w = 660; body.fontSize = 18; body.fontWeight = 400
    const footer = createText(); footer.text = 'Footer • Contact • Unsubscribe'; footer.x = 60; footer.y = 1040; footer.fontSize = 14; footer.w = 660; footer.fontWeight = 400
    setPages(ps => ps.map(p => p.id === currentPage ? { ...p, elements: [title, subtitle, hero, body, footer] } : p)); setSelected(title.id)
  }
  const applyTemplateColumns = () => {
    const title = createText(); title.text='Weekly Update'; title.x=60; title.y=40; title.fontSize=50; title.w=660
    const intro = createText(); intro.text='Short intro paragraph welcoming readers.'; intro.x=60; intro.y=110; intro.fontSize=20; intro.w=660; intro.fontWeight=400
    const colBg = createRect(); colBg.x=60; colBg.y=190; colBg.w=674; colBg.h=520; colBg.fill='#f5f7fa'; colBg.radius=12
    const col1 = createText(); col1.text='Column 1\n- Item A\n- Item B'; col1.x=80; col1.y=210; col1.w=180; col1.h=200; col1.fontSize=18; col1.fontWeight=400
    const col2 = createText(); col2.text='Column 2\nHighlight a feature'; col2.x=300; col2.y=210; col2.w=180; col2.h=200; col2.fontSize=18; col2.fontWeight=400
    const col3 = createText(); col3.text='Column 3\nKey metrics'; col3.x=520; col3.y=210; col3.w=180; col3.h=200; col3.fontSize=18; col3.fontWeight=400
    const ctaRect = createRect(); ctaRect.x=60; ctaRect.y=760; ctaRect.w=674; ctaRect.h=130; ctaRect.fill='#2684ff'; ctaRect.radius=10
    const ctaTxt = createText(); ctaTxt.text='Call To Action'; ctaTxt.x=290; ctaTxt.y=795; ctaTxt.w=220; ctaTxt.fontSize=34; ctaTxt.color='#ffffff'; ctaTxt.fontWeight=600
    setPages(ps=> ps.map(p=> p.id===currentPage ? { ...p, elements:[title,intro,colBg,col1,col2,col3,ctaRect,ctaTxt] }:p)); setSelected(title.id)
  }
  const applyTemplatePromo = () => {
    const hero = createImage('https://via.placeholder.com/1200x600.png?text=Hero'); hero.x=60; hero.y=40; hero.w=674; hero.h=340
    const overlay = createRect(); overlay.x=60; overlay.y=40; overlay.w=674; overlay.h=340; overlay.fill='#00000055'; overlay.radius=0
    const heading = createText(); heading.text='Big Seasonal Promotion'; heading.x=100; heading.y=120; heading.w=600; heading.fontSize=46; heading.color='#ffffff'
    const sub = createText(); sub.text='Save up to 50% on selected items'; sub.x=100; sub.y=190; sub.w=560; sub.fontSize=24; sub.fontWeight=400; sub.color='#ffffff'
    const body = createText(); body.text='Offer valid until DATE. Terms and conditions apply.'; body.x=60; body.y=420; body.w=660; body.fontSize=18; body.fontWeight=400
    const button = createRect(); button.x=60; button.y=500; button.w=220; button.h=70; button.fill='#2684ff'; button.radius=12
    const btnTxt = createText(); btnTxt.text='Shop Now'; btnTxt.x=95; btnTxt.y=520; btnTxt.w=170; btnTxt.fontSize=30; btnTxt.color='#fff'
    const footer = createText(); footer.text='Company • Address • Unsubscribe'; footer.x=60; footer.y=1040; footer.fontSize=14; footer.w=660; footer.fontWeight=400
    setPages(ps=> ps.map(p => p.id===currentPage ? { ...p, elements:[hero,overlay,heading,sub,body,button,btnTxt,footer] }:p)); setSelected(heading.id)
  }
  const removeSel = () => deleteSelected()

  useEffect(() => {
    if (!selectedId || !artboardRef.current) { setToolbar(t=>({...t, visible:false})); return }
    const el = getEl(selectedId)
  if (!el || el.type !== 'text') { setToolbar(t=>({...t, visible:false})); setAiOpen(false); return }
    const rect = artboardRef.current.getBoundingClientRect()
    const tx = rect.left + el.x * scale
    let ty = rect.top + (el.y - 48) * scale
    if (ty < 8) ty = rect.top + (el.y + el.h + 8) * scale
    setToolbar({ x: tx, y: ty, visible:true })
  }, [selectedId, els, scale])

  // Position AI panel below the selected text element (like reference UI)
  useEffect(() => {
    if (!aiOpen || !selectedId || !artboardRef.current) return
    const el = getEl(selectedId)
    if (!el || el.type !== 'text') return
    const rect = artboardRef.current.getBoundingClientRect()
    let x = rect.left + el.x * scale
    let y = rect.top + (el.y + el.h + 10) * scale // 10px gap below element
    const panelW = 360
    const margin = 8
    if (x + panelW + margin > window.innerWidth) x = Math.max(margin, window.innerWidth - panelW - margin)
    // If too close to bottom, keep it within viewport by nudging up a bit (best effort)
    const approxPanelH = 220
    if (y + approxPanelH + margin > window.innerHeight) {
      y = Math.max(margin, window.innerHeight - approxPanelH - margin)
    }
    setAiPos({ x, y })
  }, [aiOpen, selectedId, els, scale])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!sel || sel.type !== 'text') return
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'b') { e.preventDefault(); updateSel({ fontWeight: (sel as TextElement).fontWeight && (sel as TextElement).fontWeight! >=600 ? 400 : 700 }) }
        if (k === 'i') { e.preventDefault(); updateSel({ fontStyle: (sel as TextElement).fontStyle === 'italic' ? 'normal':'italic' }) }
        if (k === 'u') { e.preventDefault(); updateSel({ underline: !(sel as TextElement).underline }) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sel])

  return (
    <div className={styles.wrapper} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      <aside className={styles.leftPanel}>
        <h3>Elements</h3>
        <div className={styles.palette}>
          <button onClick={() => { const t=createText(); t.text='Heading'; t.fontSize=48; updateCurrent(list=>[...list,t]); setSelected(t.id) }}>Heading</button>
          <button onClick={() => { const t=createText(); t.text='Subheading'; t.fontSize=28; updateCurrent(list=>[...list,t]); setSelected(t.id) }}>Subheading</button>
          <button onClick={() => { const t=createText(); t.text='Body text'; t.fontSize=18; t.fontWeight=400; updateCurrent(list=>[...list,t]); setSelected(t.id) }}>Body</button>
          <button onClick={addRect}>Rectangle</button>
          <button onClick={addImgUrl}>Image URL</button>
        </div>
        <div className={styles.templateSection}>
          <h3>Templates</h3>
          <button className={styles.templateBtn} onClick={applyNewsletterTemplate}>Basic<br/><span>Hero + list</span></button>
          <button className={styles.templateBtn} onClick={applyTemplateColumns}>Columns<br/><span>3 column + CTA</span></button>
          <button className={styles.templateBtn} onClick={applyTemplatePromo}>Promo<br/><span>Hero overlay</span></button>
        </div>
        <div className={styles.assetSection}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <strong style={{ fontSize:11, letterSpacing:'.05em', textTransform:'uppercase', color:'#7d8590' }}>Assets</strong>
            <input className={styles.assetUpload} type="file" accept="image/*" onChange={onUpload} />
          </div>
          <div className={styles.assetGrid}>
            {assets.map((a,i) => (
              <div key={i} className={styles.assetCell} onClick={() => addImgAsset(a)}>
                <img src={a} />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.actionBar}>
          <button onClick={()=> navigate('/preview')}>Preview</button>
          <button onClick={exportJSON}>Export JSON</button>
            <button disabled={exportingPng} onClick={exportPNG}>{exportingPng? 'PNG...' : 'Export PNG'}</button>
          <button disabled={exportingPdf} onClick={exportPDF}>{exportingPdf ? 'PDF...' : 'Export PDF'}</button>
          <button onClick={()=>updateCurrent(()=>[])}>Clear</button>
        </div>
        <div className={styles.pageBar}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <strong style={{ fontSize:11, letterSpacing:'.05em', textTransform:'uppercase', color:'#7d8590' }}>Pages</strong>
            <div style={{ display:'flex', gap:6 }}>
              <button className={styles.addPageBtnSmall} onClick={addPage}>+ Page</button>
              <button className={styles.addPageBtnSmall} disabled={pages.length<2} onClick={()=>{ if(pages.length<2) return; if(!confirm('Delete this page?')) return; setPages(ps=> ps.filter(p=>p.id!==currentPage)); setTimeout(()=>{ const pgs = pages.filter(p=>p.id!==currentPage); if(pgs[0]) setCurrentPage(pgs[0].id); },0) }}>Del</button>
            </div>
          </div>
          <div className={styles.pageManage}>
            <input value={pages.find(p=>p.id===currentPage)?.name||''} onChange={e=> setPages(ps=> ps.map(p=> p.id===currentPage? { ...p, name:e.target.value }:p))} />
          </div>
          <div className={styles.pageList}>
            {pages.map(p => (
              <div key={p.id} className={`${styles.pageChip} ${p.id===currentPage?styles.active:''}`} onClick={()=>{setCurrentPage(p.id); setSelected(null)}}>{p.name}</div>
            ))}
          </div>
        </div>
      </aside>
      <div className={styles.centerArea}>
        <div className={styles.canvasOuter}>
          <div className={styles.artboardShell}>
            {toolbar.visible && sel && sel.type==='text' && (
              <div className={styles.inlineToolbar} style={{ left: toolbar.x, top: toolbar.y }}>
                {(() => { const t = sel as TextElement; return (
                  <>
                    <button className={`${styles.styleBtn} ${(t.fontWeight||400)>=600? styles.active:''}`} onClick={()=> updateSel({ fontWeight:(t.fontWeight||400)>=600?400:700 })}>B</button>
                    <button className={`${styles.styleBtn} ${t.fontStyle==='italic'? styles.active:''}`} onClick={()=> updateSel({ fontStyle:t.fontStyle==='italic'?'normal':'italic' })}>I</button>
                    <button className={`${styles.styleBtn} ${t.underline? styles.active:''}`} onClick={()=> updateSel({ underline:!t.underline })}>U</button>
                    <div className={styles.alignGroup}>
                      <button className={`${styles.styleBtn} ${t.textAlign==='left'? styles.active:''}`} onClick={()=> updateSel({ textAlign:'left' })}>L</button>
                      <button className={`${styles.styleBtn} ${t.textAlign==='center'? styles.active:''}`} onClick={()=> updateSel({ textAlign:'center' })}>C</button>
                      <button className={`${styles.styleBtn} ${t.textAlign==='right'? styles.active:''}`} onClick={()=> updateSel({ textAlign:'right' })}>R</button>
                    </div>
                    <select value={t.fontFamily} onChange={e=> updateSel({ fontFamily:e.target.value })}>
                      <option value="system-ui, sans-serif">System UI</option>
                      <option value="Inter, system-ui, sans-serif">Inter</option>
                      <option value="Roboto, system-ui, sans-serif">Roboto</option>
                      <option value="Montserrat, system-ui, sans-serif">Montserrat</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                      <option value="Arial, sans-serif">Arial</option>
                    </select>
                    <button className={styles.styleBtn} onClick={() => setAiOpen(v => !v)}>AI ✨</button>
                  </>
                )})()}
              </div>
            )}
            {aiOpen && sel && sel.type==='text' && (
              <div className={styles.aiPanel} style={{ left: aiPos.x, top: aiPos.y }}>
                <div className={styles.aiHeader}>
                  <strong className={styles.aiTitle}>Rewrite with AI</strong>
                  <button className={styles.aiClose} onClick={()=> setAiOpen(false)}>×</button>
                </div>
                <div className={styles.aiControls}>
                  <select className={styles.aiSelect} value={aiTone} onChange={(e)=> setAiTone(e.target.value)}>
                    <option>Concise</option>
                    <option>Friendly</option>
                    <option>Professional</option>
                    <option>Expand</option>
                  </select>
                  <button className={styles.aiRewriteBtn} disabled={aiLoading} onClick={async ()=>{ if (!sel || sel.type!=='text') return; setAiLoading(true); setAiError(null); setAiOutput(''); try { const out = await rewriteWithAI((sel as TextElement).text, aiTone); setAiOutput(out); } catch (err:any) { setAiError(err.message||'Failed'); } finally { setAiLoading(false); } }}>{aiLoading ? 'Rewriting…' : 'Rewrite'}</button>
                </div>
                {aiError && <div className={styles.aiError}>{aiError}</div>}
                <div className={styles.aiOutput}>{aiOutput || '—'}</div>
                <div className={styles.aiActions}>
                  <button className={`${styles.aiBtn} ${styles.aiBtnPrimary}`} disabled={!aiOutput} onClick={()=>{ if (!sel || sel.type!=='text' || !aiOutput) return; onTextEdit(sel.id, aiOutput); setAiOpen(false) }}>Replace</button>
                  <button className={styles.aiBtn} disabled={!aiOutput} onClick={()=>{ if (!sel || sel.type!=='text' || !aiOutput) return; onTextEdit(sel.id, ((sel as TextElement).text + '\n' + aiOutput)); setAiOpen(false) }}>Add below</button>
                  <button className={styles.aiBtn} disabled={!aiOutput} onClick={async ()=>{ if (!aiOutput) return; await navigator.clipboard.writeText(aiOutput) }}>Copy</button>
                </div>
              </div>
            )}
            <div className={styles.zoomBadge}>
              <button onClick={zoomOut}>-</button>
              <span>{Math.round(scale*100)}%</span>
              <button onClick={zoomIn}>+</button>
              <button onClick={resetZoom}>reset</button>
            </div>
            <div ref={artboardRef} className={styles.artboard} style={{ transform:`scale(${scale})` }} onPointerDown={() => selectEl(null)} onWheel={(e) => { if (e.ctrlKey) onArtboardWheel(e) }}>
              {guideX !== null && <div className={`${styles.guide} ${styles.v}`} style={{ left:guideX }} />}
              {guideY !== null && <div className={`${styles.guide} ${styles.h}`} style={{ top:guideY }} />}
              {els.length === 0 && <div className={styles.emptyHint}>Add elements from left</div>}
              {els.map(el => {
                if (el.type === 'text') {
                  const t = el as TextElement
                  return (
                    <div key={el.id} className={`${styles.el} ${el.id === selectedId ? styles.selected : ''} ${styles.textBox}`} style={{ left:t.x, top:t.y, width:t.w, height:t.h }} onPointerDown={e => onPointerDown(e, el.id)}>
                      <div
                        className={styles.inlineEdit}
                        contentEditable
                        suppressContentEditableWarning
                        style={{ fontSize:t.fontSize, fontWeight:t.fontWeight, color:t.color, fontStyle:t.fontStyle, textDecoration:t.underline? 'underline':'none', fontFamily:t.fontFamily, textAlign:t.textAlign }}
                        onFocus={() => setEditingId(t.id)}
                        onBlur={e => handleTextBlur(t.id, e)}
                        onInput={e => handleTextInput(t.id, e)}
                      >{editingId === t.id ? undefined : t.text}</div>
                      {el.id === selectedId && <div className={`${styles.resizeHandle} ${styles['rh-br']}`} onPointerDown={e => onResizeDown(e, el.id, 'br')} />}
                    </div>
                  )
                }
                if (el.type === 'rect') {
                  const r = el as RectElement
                  return (
                    <div key={el.id} className={`${styles.el} ${el.id === selectedId ? styles.selected : ''}`} style={{ left:r.x, top:r.y, width:r.w, height:r.h, background:r.fill, borderRadius:r.radius }} onPointerDown={e => onPointerDown(e, el.id)}>
                      {el.id === selectedId && <div className={`${styles.resizeHandle} ${styles['rh-br']}`} onPointerDown={e => onResizeDown(e, el.id, 'br')} />}
                    </div>
                  )
                }
                if (el.type === 'image') {
                  const im = el as ImageElement
                  return (
                    <div key={el.id} className={`${styles.el} ${styles.imageEl} ${el.id === selectedId ? styles.selected : ''}`} style={{ left:im.x, top:im.y, width:im.w, height:im.h }} onPointerDown={e => onPointerDown(e, el.id)}>
                      <img src={im.src} style={{ objectFit: im.fit }} />
                      {el.id === selectedId && <div className={`${styles.resizeHandle} ${styles['rh-br']}`} onPointerDown={e => onResizeDown(e, el.id, 'br')} />}
                    </div>
                  )
                }
                return null
              })}
              {exporting && (
                <div className={styles.exportBox}>
                  <button className={styles.closeExport} onClick={() => setExporting(false)}>×</button>
                  <pre style={{ margin:0 }}>{json}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Bottom zoom bar */}
        <div className={styles.bottomZoomBar}>
          <button onClick={zoomOut}>-</button>
          <span className="zoomPct">{Math.round(scale * 100)}%</span>
          <input type="range" min={25} max={300} value={Math.round(scale * 100)} onChange={(e) => setScale(Math.max(0.25, Math.min(3, parseInt(e.target.value, 10) / 100)))} />
          <button onClick={zoomIn}>+</button>
          <button onClick={resetZoom}>Reset</button>
          <button disabled={exportingPdf} onClick={exportPDF}>{exportingPdf ? 'PDF…' : 'Export PDF'}</button>
        </div>
      </div>
      <aside className={styles.rightPanel}>
        <div className={styles.section}>
          <h4>Properties</h4>
          {!sel && <div style={{ fontSize:12, opacity:.6 }}>Select an element</div>}
          {sel && sel.type === 'text' && (() => { const t = sel as TextElement; return (
            <div>
              <div className={styles.propRow}>
                <label>Font Size</label>
                <input type="range" min={10} max={120} value={t.fontSize} onChange={e => updateSel({ fontSize: parseInt(e.target.value,10) })} />
              </div>
              <div className={styles.propRow}>
                <label>Color</label>
                <input type="color" value={t.color} onChange={e => updateSel({ color: e.target.value })} />
              </div>
              <div className={styles.propRow}>
                <label>Font Family</label>
                <select className={styles.fontSelect} value={t.fontFamily || 'system-ui, sans-serif'} onChange={e => updateSel({ fontFamily: e.target.value })}>
                  <option value="system-ui, sans-serif">System UI</option>
                  <option value="Inter, system-ui, sans-serif">Inter</option>
                  <option value="Roboto, system-ui, sans-serif">Roboto</option>
                  <option value="Montserrat, system-ui, sans-serif">Montserrat</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="Arial, sans-serif">Arial</option>
                </select>
              </div>
              <div className={styles.propRow}>
                <label>Weight</label>
                <select value={t.fontWeight || 400} onChange={e => updateSel({ fontWeight: parseInt(e.target.value,10) })}>
                  {[300,400,500,600,700,800].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className={styles.propRow}>
                <label>Style</label>
                <div className={styles.styleToggleGroup}>
                  <button type="button" className={`${styles.styleBtn} ${ (t.fontWeight||400) >= 600 ? styles.active : '' }`} onClick={()=> updateSel({ fontWeight: (t.fontWeight||400) >= 600 ? 400 : 700 })}>B</button>
                  <button type="button" className={`${styles.styleBtn} ${ t.fontStyle === 'italic' ? styles.active : '' }`} onClick={()=> updateSel({ fontStyle: t.fontStyle === 'italic' ? 'normal':'italic' })}>I</button>
                  <button type="button" className={`${styles.styleBtn} ${ t.underline ? styles.active : '' }`} onClick={()=> updateSel({ underline: !t.underline })}>U</button>
                </div>
              </div>
            </div>
          )})()}
          {sel && sel.type === 'rect' && (
            <div>
              <div className={styles.propRow}>
                <label>Fill</label>
                <input type="color" value={(sel as RectElement).fill} onChange={e => updateSel({ fill: e.target.value })} />
              </div>
              <div className={styles.propRow}>
                <label>Radius</label>
                <input type="range" min={0} max={120} value={(sel as RectElement).radius} onChange={e => updateSel({ radius: parseInt(e.target.value,10) })} />
              </div>
            </div>
          )}
          {sel && sel.type === 'image' && (
            <div>
              <div className={styles.propRow}>
                <label>Image URL</label>
                <input value={(sel as ImageElement).src} onChange={e => updateSel({ src: e.target.value })} />
              </div>
              <div className={styles.propRow}>
                <label>Fit</label>
                <select value={(sel as ImageElement).fit} onChange={e => updateSel({ fit: e.target.value })}>
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className={styles.section}>
          <h4>Arrange</h4>
          <div style={{ display:'flex', gap:8 }}>
            <button disabled={!sel} onClick={sendBackward}>Back</button>
            <button disabled={!sel} onClick={bringForward}>Forward</button>
            <button disabled={!sel} onClick={duplicateSel}>Duplicate</button>
            <button disabled={!sel} onClick={removeSel}>Delete</button>
          </div>
        </div>
        <div className={styles.section}>
          <h4>Layers</h4>
          <div className={styles.layerList}>
            {els.map(e => (
              <div key={e.id} className={`${styles.layerItem} ${e.id === selectedId ? styles.active : ''}`} onClick={() => setSelected(e.id)}>
                <span>{e.type}</span>
                <span style={{ opacity:.6 }}>{e.w}×{e.h}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

