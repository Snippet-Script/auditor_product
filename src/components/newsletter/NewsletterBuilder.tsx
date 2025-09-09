import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from './NewsletterBuilder.module.css'
import { useAuth } from '../../auth/auth'
import { useNavigate } from 'react-router-dom'

type Tonality = 'casual' | 'formal' | 'informal'

interface ContentState {
	title: string
	subtitle: string
	heroImageUrl: string
	tagline: string
	section1: string
	section2: string
	sectionLeft: string
	sectionRight: string
	script: string
	tonality: Tonality
	sources: string
}

const STORAGE_KEY = 'newsletter-draft-v1'

const initialContent: ContentState = {
	title: '',
	subtitle: '',
	heroImageUrl: '',
	tagline: '',
	section1: '',
	section2: '',
	sectionLeft: '',
	sectionRight: '',
	script: '',
	tonality: 'casual',
	sources: ''
}

type BlockType = 'heading' | 'paragraph' | 'image' | 'divider'
interface Block { id: string; type: BlockType; html?: string; url?: string }

interface ThemeState { fontFamily: string; accent: string; text: string; bg: string; headingSize: number; }
const defaultTheme: ThemeState = { fontFamily: 'system-ui, sans-serif', accent: '#1db954', text: '#222', bg: '#ffffff', headingSize: 28 }

interface Page { id: string; name: string; blocks: Block[] }
const PAGES_KEY = 'newsletter-pages-v1'

const CREDITS_KEY = 'newsletter-credits-v1'
const DEFAULT_CREDITS = 1000

export default function NewsletterBuilder() {
	const [tab, setTab] = useState<'content' | 'design' | 'theme' | 'assets'>('content')
	const [content, setContent] = useState<ContentState>(() => {
		try { const raw = localStorage.getItem(STORAGE_KEY + ':content'); if (raw) return { ...initialContent, ...JSON.parse(raw) } } catch {}
		return initialContent
	})
	const [pages, setPages] = useState<Page[]>(() => {
		try {
			const existing = localStorage.getItem(PAGES_KEY)
			if (existing) return JSON.parse(existing)
			const legacy = localStorage.getItem(STORAGE_KEY + ':blocks')
			if (legacy) {
				return [{ id: crypto.randomUUID(), name: 'Page 1', blocks: JSON.parse(legacy) }]
			}
		} catch {}
		return [{
			id: crypto.randomUUID(),
			name: 'Page 1',
			blocks: [
				{ id: crypto.randomUUID(), type: 'heading', html: 'Your Newsletter Title' },
				{ id: crypto.randomUUID(), type: 'paragraph', html: 'Introduce your main topic here.' }
			]
		}]
	})
	const [currentPageId, setCurrentPageId] = useState<string>(() => pages[0].id)
	const [assets, setAssets] = useState<string[]>(() => {
		try { const raw = localStorage.getItem(STORAGE_KEY + ':assets'); if (raw) return JSON.parse(raw) } catch {}
		return []
	})
	const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
	const [theme, setTheme] = useState<ThemeState>(() => {
		try { const raw = localStorage.getItem(STORAGE_KEY + ':theme'); if (raw) return { ...defaultTheme, ...JSON.parse(raw) } } catch {}
		return defaultTheme
	})
	const [preview, setPreview] = useState('')
	const [credits, setCredits] = useState<number>(() => {
		const raw = localStorage.getItem(CREDITS_KEY)
		const n = raw ? parseInt(raw, 10) : DEFAULT_CREDITS
		return isNaN(n) ? DEFAULT_CREDITS : n
	})
	const { logout } = useAuth()
	const navigate = useNavigate()

	const update = (patch: Partial<ContentState>) => setContent(c => ({ ...c, ...patch }))

	useEffect(() => { localStorage.setItem(STORAGE_KEY + ':content', JSON.stringify(content)) }, [content])
	useEffect(() => { localStorage.setItem(PAGES_KEY, JSON.stringify(pages)) }, [pages])
	useEffect(() => { localStorage.setItem(CREDITS_KEY, String(credits)) }, [credits])
	useEffect(() => { localStorage.setItem(STORAGE_KEY + ':assets', JSON.stringify(assets)) }, [assets])
	useEffect(() => { localStorage.setItem(STORAGE_KEY + ':theme', JSON.stringify(theme)) }, [theme])

	const dragId = useRef<string | null>(null)
	const [dragOverId, setDragOverId] = useState<string | null>(null)
	const onDragStart = (id: string) => (e: React.DragEvent) => { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; setDragOverId(id) }
	const onDragOver = (id: string) => (e: React.DragEvent) => { e.preventDefault(); if (dragId.current === id) return; setDragOverId(id) }
	const onDrop = (id: string) => (e: React.DragEvent) => {
		e.preventDefault();
		const from = dragId.current;
		dragId.current = null;
		if (!from || from === id) return;
		setPages(prev => prev.map(p => {
			if (p.id !== currentPageId) return p
			const arr = [...p.blocks]
			const fromIdx = arr.findIndex(b => b.id === from)
			const toIdx = arr.findIndex(b => b.id === id)
			if (fromIdx === -1 || toIdx === -1) return p
			const [moved] = arr.splice(fromIdx, 1)
			arr.splice(toIdx, 0, moved)
			return { ...p, blocks: arr }
		}))
		setDragOverId(null)
	}

	const currentBlocks = pages.find(p => p.id === currentPageId)?.blocks || []
	const updateCurrent = (mut: (b: Block[]) => Block[]) => setPages(ps => ps.map(p => p.id === currentPageId ? { ...p, blocks: mut(p.blocks) } : p))
	const addBlock = (type: BlockType) => {
		const base: Block = { id: crypto.randomUUID(), type }
		if (type === 'heading') base.html = 'New Heading'
		if (type === 'paragraph') base.html = 'New paragraph text.'
		if (type === 'divider') base.html = '<hr />'
		updateCurrent(b => [...b, base])
	}
	const removeBlock = (id: string) => updateCurrent(b => b.filter(x => x.id !== id))
	const duplicateBlock = (id: string) => updateCurrent(b => { const blk = b.find(x => x.id === id); if (!blk) return b; return [...b, { ...blk, id: crypto.randomUUID() }] })
	const updateBlockHtml = (id: string, html: string) => updateCurrent(b => b.map(x => x.id === id ? { ...x, html } : x))
	const setBlockImage = (id: string, url: string) => updateCurrent(b => b.map(x => x.id === id ? { ...x, url } : x))

	const addPage = () => setPages(p => [...p, { id: crypto.randomUUID(), name: `Page ${p.length + 1}`, blocks: [] }])
	const deletePage = (id: string) => setPages(p => {
		if (p.length === 1) return p
		const next = p.filter(pg => pg.id !== id)
		if (!next.find(pg => pg.id === currentPageId)) setCurrentPageId(next[0].id)
		return next
	})
	const duplicatePage = (id: string) => setPages(p => {
		const tgt = p.find(pg => pg.id === id); if (!tgt) return p
		return [...p, { id: crypto.randomUUID(), name: tgt.name + ' Copy', blocks: tgt.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) }]
	})
	const renamePage = (id: string, name: string) => setPages(p => p.map(pg => pg.id === id ? { ...pg, name } : pg))

	const buildPreview = useCallback(() => {
		const html = pages.map((pg, i) => {
			const inner = pg.blocks.map(b => {
				if (b.type === 'heading') return `<h1 style="font-size:${theme.headingSize}px;">${b.html || ''}</h1>`
				if (b.type === 'paragraph') return `<p>${b.html || ''}</p>`
				if (b.type === 'image' && b.url) return `<div style="text-align:center; margin:18px 0"><img src="${b.url}" style="max-width:100%;"/></div>`
				if (b.type === 'divider') return '<hr style="margin:28px 0; border:none; border-top:1px solid #ccc;" />'
				return ''
			}).join('\n')
			return `<section data-page="${pg.name}">${inner}${i < pages.length - 1 ? '<hr style=\\"border:none; border-top:3px double #999; margin:50px 0\\" />' : ''}</section>`
		}).join('\n')
		setPreview(`<div style="font-family:${theme.fontFamily}; color:${theme.text}; background:${theme.bg};">${html}</div>`)
	}, [pages, theme])
	useEffect(() => { buildPreview() }, [pages, theme, buildPreview])

	const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]; if (!file) return;
		const reader = new FileReader();
		reader.onload = ev => { if (typeof ev.target?.result === 'string') setAssets(a => [...a, ev.target!.result as string]) };
		reader.readAsDataURL(file);
	};

	const goHome = () => navigate('/home');

	const spendCredits = (amount: number) => setCredits(c => Math.max(0, c - amount))
	const requireCredits = (amount: number) => credits >= amount

	const templates: { id: string; name: string; build: () => Block[] }[] = [
		{ id: 'simple', name: 'Simple', build: () => [
			{ id: crypto.randomUUID(), type: 'heading', html: content.title || 'Newsletter Title' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.subtitle || 'Subtitle or intro paragraph.' },
			content.heroImageUrl ? { id: crypto.randomUUID(), type: 'image', url: content.heroImageUrl } : null,
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.section1 || 'Main body section.' },
			{ id: crypto.randomUUID(), type: 'divider', html: '<hr />' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.section2 || 'Closing remarks.' },
		].filter(Boolean) as Block[] },
		{ id: 'feature', name: 'Feature Focus', build: () => [
			{ id: crypto.randomUUID(), type: 'heading', html: content.title || 'Feature Focus' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.tagline || 'Key tagline goes here.' },
			content.heroImageUrl ? { id: crypto.randomUUID(), type: 'image', url: content.heroImageUrl } : null,
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.sectionLeft || 'Left column narrative.' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.sectionRight || 'Right column narrative.' },
			{ id: crypto.randomUUID(), type: 'divider', html: '<hr />' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.sources ? 'Sources: ' + content.sources : 'Sources: (add sources)' },
		].filter(Boolean) as Block[] },
		{ id: 'promo', name: 'Promo', build: () => [
			{ id: crypto.randomUUID(), type: 'heading', html: (content.title || 'Big Announcement').toUpperCase() },
			{ id: crypto.randomUUID(), type: 'paragraph', html: content.subtitle || 'Short compelling subheading.' },
			content.heroImageUrl ? { id: crypto.randomUUID(), type: 'image', url: content.heroImageUrl } : null,
			{ id: crypto.randomUUID(), type: 'divider', html: '<hr />' },
			{ id: crypto.randomUUID(), type: 'paragraph', html: (content.section1 || '') + '<br/><strong>Call to Action:</strong> ' + (content.section2 || 'Join now!') },
		].filter(Boolean) as Block[] }
	]

	const applyTemplate = (tplId: string) => {
		const tpl = templates.find(t => t.id === tplId)
		if (!tpl) return
		updateCurrent(() => tpl.build())
	}

	const AI_COST = 25
	const generateFromScript = async () => {
		if (!requireCredits(AI_COST)) { alert('Not enough credits.'); return }
		spendCredits(AI_COST)
		await new Promise(r => setTimeout(r, 600))
		const baseText = content.script || 'Generated newsletter content.'
		const src = content.sources ? `\nSources: ${content.sources}` : ''
		const tone = content.tonality
		const produced = `${baseText}\n\nTone: ${tone}${src}`
		updateCurrent(b => {
			const existingParagraph = b.find(x => x.type === 'paragraph')
			if (existingParagraph) {
				return b.map(x => x.id === existingParagraph.id ? { ...x, html: produced.replace(/\n/g, '<br/>') } : x)
			}
			return [...b, { id: crypto.randomUUID(), type: 'paragraph', html: produced.replace(/\n/g, '<br/>') }]
		})
	}

	return (
		<div className={styles.outerRoot}>
			<div className={styles.topBar}>
				<div className={styles.brand} onClick={goHome}>product</div>
				<div className={styles.topTabs}>
					{['content','design','theme','assets'].map(t => (
						<button key={t} className={tab === t ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab} onClick={() => setTab(t as any)}>{t}</button>
					))}
				</div>
				<div className={styles.creditPill}>{credits} <span>credits</span></div>
			</div>
			<div className={styles.container}>
			<aside className={styles.sideBar}>
				{tab === 'content' && (
					<div className={styles.panelScroll}>
						<label className={styles.sectionLabel}>title</label>
						<input className={styles.input} value={content.title} onChange={e => update({ title: e.target.value })} />
						<label className={styles.sectionLabel}>subtitle</label>
						<input className={styles.input} value={content.subtitle} onChange={e => update({ subtitle: e.target.value })} />
						<label className={styles.sectionLabel}>hero image url</label>
						<input className={styles.input} value={content.heroImageUrl} onChange={e => update({ heroImageUrl: e.target.value })} />
						<label className={styles.sectionLabel}>tagline</label>
						<input className={styles.input} value={content.tagline} onChange={e => update({ tagline: e.target.value })} />
						<label className={styles.sectionLabel}>section 1</label>
						<textarea className={styles.textarea} value={content.section1} onChange={e => update({ section1: e.target.value })} />
						<label className={styles.sectionLabel}>section 2</label>
						<textarea className={styles.textarea} value={content.section2} onChange={e => update({ section2: e.target.value })} />
						<div className={styles.fieldGroup}>
							<div style={{ flex:1 }}>
								<label className={styles.sectionLabel}>left</label>
								<input className={styles.input} value={content.sectionLeft} onChange={e => update({ sectionLeft: e.target.value })} />
							</div>
							<div style={{ flex:1 }}>
								<label className={styles.sectionLabel}>right</label>
								<input className={styles.input} value={content.sectionRight} onChange={e => update({ sectionRight: e.target.value })} />
							</div>
						</div>
						<label className={styles.sectionLabel}>script (prompt)</label>
						<textarea className={styles.textarea} value={content.script} onChange={e => update({ script: e.target.value })} />
						<label className={styles.sectionLabel}>tonality</label>
						<div className={styles.radioRow}>
							{(['casual','formal','informal'] as Tonality[]).map(tone => (
								<label key={tone}><input type="radio" checked={content.tonality === tone} onChange={() => update({ tonality: tone })} /> {tone}</label>
							))}
						</div>
						<label className={styles.sectionLabel}>sources</label>
						<textarea className={styles.textarea} value={content.sources} onChange={e => update({ sources: e.target.value })} />
						<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
							<button className={styles.autoDesignBtn} onClick={() => applyTemplate('simple')}>simple template</button>
							<button className={styles.autoDesignBtn} onClick={() => applyTemplate('feature')}>feature template</button>
							<button className={styles.autoDesignBtn} onClick={() => applyTemplate('promo')}>promo template</button>
							<button className={styles.autoDesignBtn} disabled={!requireCredits(AI_COST)} onClick={generateFromScript}>AI generate (-{AI_COST})</button>
						</div>
						<div style={{ display:'flex', gap:8, marginTop:12 }}>
							<button onClick={goHome}>home</button>
							<button onClick={() => { logout(); navigate('/') }}>logout</button>
						</div>
					</div>
				)}
				{tab !== 'content' && <div className={styles.tabsPlaceholder}></div>}
				{tab === 'design' && (
					<div className={styles.panelScroll}>
						<div className={styles.pageTabs}>
							{pages.map(p => (
								<div key={p.id} className={p.id === currentPageId ? `${styles.pageTab} ${styles.pageTabActive}` : styles.pageTab}>
									<button onClick={() => setCurrentPageId(p.id)} onDoubleClick={() => {
										const name = prompt('Rename page', p.name); if (name) renamePage(p.id, name)
									}}>{p.name}</button>
									<div className={styles.pageTabMenu}>
										<button onClick={() => duplicatePage(p.id)} title="Duplicate">⧉</button>
										<button onClick={() => deletePage(p.id)} title="Delete">×</button>
									</div>
								</div>
							))}
							<button className={styles.addPageBtn} onClick={addPage}>+ Page</button>
						</div>
						<div className={styles.addBlockBar}>
							<button onClick={() => addBlock('heading')}>+ heading</button>
							<button onClick={() => addBlock('paragraph')}>+ paragraph</button>
							<button onClick={() => addBlock('image')}>+ image</button>
							<button onClick={() => addBlock('divider')}>+ divider</button>
						</div>
						<div className={styles.blockList}>
							{currentBlocks.map(b => (
								<div key={b.id} className={b.id === dragOverId ? `${styles.blockItem} ${styles.blockItemDragOver}` : styles.blockItem} draggable onDragStart={onDragStart(b.id)} onDragOver={onDragOver(b.id)} onDrop={onDrop(b.id)} onDragEnd={() => setDragOverId(null)}>
									<div className={styles.dragHandle}>☰</div>
									<div className={styles.blockContent}>
										{b.type === 'image' ? (
											<div style={{ display:'flex', flexDirection:'column', gap:6 }}>
												<input className={styles.input} placeholder="Image URL or select from assets" value={b.url || ''} onChange={e => setBlockImage(b.id, e.target.value)} />
												{selectedAsset && <button onClick={() => setBlockImage(b.id, selectedAsset)}>Use selected asset</button>}
											</div>
										) : (
											<RichTextEditable initialHtml={b.html || ''} onChange={html => updateBlockHtml(b.id, html)} />
										)}
									</div>
									<div className={styles.blockToolbar}>
										<button onClick={() => duplicateBlock(b.id)}>dup</button>
										<button onClick={() => removeBlock(b.id)}>x</button>
									</div>
								</div>
							))}
						</div>
						<button style={{ marginTop:12 }} className={styles.autoDesignBtn} onClick={buildPreview}>update preview</button>
						<div style={{ display:'flex', gap:8, marginTop:16 }}>
							<button onClick={goHome}>back</button>
							<button onClick={() => { logout(); navigate('/') }}>logout</button>
						</div>
					</div>
				)}
				{tab === 'theme' && (
					<div className={styles.panelScroll}>
						<div className={styles.themeGrid}>
							<div className={styles.themeRow}>
								<label>Font family</label>
								<input className={styles.input} value={theme.fontFamily} onChange={e => setTheme(t => ({ ...t, fontFamily: e.target.value }))} />
							</div>
							<div className={styles.themeRow}>
								<label>Accent color</label>
								<input type="color" className={styles.input} value={theme.accent} onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))} />
							</div>
							<div className={styles.themeRow}>
								<label>Text color</label>
								<input type="color" className={styles.input} value={theme.text} onChange={e => setTheme(t => ({ ...t, text: e.target.value }))} />
							</div>
							<div className={styles.themeRow}>
								<label>Background</label>
								<input type="color" className={styles.input} value={theme.bg} onChange={e => setTheme(t => ({ ...t, bg: e.target.value }))} />
							</div>
							<div className={styles.themeRow} style={{ gridColumn:'1 / span 2' }}>
								<label>Heading size: {theme.headingSize}px</label>
								<input type="range" min={18} max={48} value={theme.headingSize} onChange={e => setTheme(t => ({ ...t, headingSize: parseInt(e.target.value,10) }))} />
							</div>
						</div>
						<button className={styles.autoDesignBtn} style={{ marginTop:12 }} onClick={buildPreview}>refresh preview</button>
					</div>
				)}
				{tab === 'assets' && (
					<div className={styles.panelScroll}>
						<div className={styles.assetSection}>
							<input className={styles.uploadInput} type="file" accept="image/*" onChange={handleAssetUpload} />
							<div className={styles.assetList}>
								{assets.map(a => (
									<div key={a} className={a === selectedAsset ? `${styles.assetThumb} ${styles.selected}` : styles.assetThumb} onClick={() => setSelectedAsset(a)}>
										<img src={a} />
									</div>
								))}
							</div>
							{selectedAsset && <button onClick={() => setSelectedAsset(null)}>clear selection</button>}
						</div>
					</div>
				)}
			</aside>
			<main className={styles.canvasColumn}>
				<div className={`${styles.canvasPanel} ${styles.blockPanel}`}>
					<div className={styles.toolbar}>
						<button onClick={buildPreview}>Render</button>
						<button onClick={() => setPreview('')}>Clear</button>
					</div>
					<strong>Blocks</strong>
					<p style={{ fontSize:11, margin:0 }}>Drag to reorder. Edit inline. Use assets tab for images.</p>
				</div>
				<div className={`${styles.canvasPanel} ${styles.previewPanelWrapper}`}>
					<strong>Preview</strong>
					<div className={styles.previewPanel} style={{ background: theme.bg }}>
						{preview ? (
							<div className={styles.previewOuter} style={{ fontFamily: theme.fontFamily, color: theme.text }} dangerouslySetInnerHTML={{ __html: preview }} />
						) : (
							<p style={{ margin:0, fontSize:12, color:'#888', padding:12 }}>No preview yet. Click Render.</p>
						)}
					</div>
				</div>
			</main>
			</div>
		</div>
	);
}

function RichTextEditable({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
	const ref = useRef<HTMLDivElement | null>(null);
	useEffect(() => { if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = initialHtml }, [initialHtml]);
	return (
		<div className={styles.rteWrapper}>
			<div className={styles.rteToolbar}>
				{[
					{ cmd: 'bold', label: 'B' },
					{ cmd: 'italic', label: 'I' },
					{ cmd: 'underline', label: 'U' },
					{ cmd: 'insertUnorderedList', label: '• list' },
					{ cmd: 'formatBlock', val: 'h2', label: 'H2' },
					{ cmd: 'formatBlock', val: 'p', label: 'P' }
				].map(b => (
					<button key={b.label} onMouseDown={e => { e.preventDefault(); document.execCommand(b.cmd, false, b.val) }}>{b.label}</button>
				))}
			</div>
			<div
				ref={ref}
				className={styles.rteEditable}
				data-placeholder="Type..."
				contentEditable
				suppressContentEditableWarning
				onInput={() => { if (ref.current) onChange(ref.current.innerHTML) }}
			/>
		</div>
	);
}

