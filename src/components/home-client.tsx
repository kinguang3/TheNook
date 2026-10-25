'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Book, RatingStat } from '@/lib/types'
import { toggleFavorite } from '@/app/actions/user-data'

type SortKey = 'year' | 'rating'
type RegionFilter = 'all' | 'uk' | 'jp'
type EraFilter = 'all' | 'pre-1980' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s'
type TypeFilter = 'all' | 'detective' | 'standalone' | 'locked-room' | 'serial'

const regionOptions: { value: RegionFilter; label: string; field: 'REGION' }[] = [
  { value: 'all', label: '全部地区', field: 'REGION' },
  { value: 'uk', label: '欧美', field: 'REGION' },
  { value: 'jp', label: '日系', field: 'REGION' },
]

const eraOptions: { value: EraFilter; label: string; field: 'ERA' }[] = [
  { value: 'all', label: '全部年代', field: 'ERA' },
  { value: 'pre-1980', label: '1980 年前', field: 'ERA' },
  { value: '1980s', label: '1980s', field: 'ERA' },
  { value: '1990s', label: '1990s', field: 'ERA' },
  { value: '2000s', label: '2000s', field: 'ERA' },
  { value: '2010s', label: '2010s', field: 'ERA' },
  { value: '2020s', label: '2020s', field: 'ERA' },
]

const typeOptions: { value: TypeFilter; label: string; field: 'TYPE' }[] = [
  { value: 'all', label: '全部类型', field: 'TYPE' },
  { value: 'detective', label: '本格推理', field: 'TYPE' },
  { value: 'standalone', label: '独立作品', field: 'TYPE' },
  { value: 'locked-room', label: '孤岛/不可能犯罪', field: 'TYPE' },
  { value: 'serial', label: '连环杀手', field: 'TYPE' },
]

interface HomeClientProps {
  initialBooks: Book[]
  favorites?: string[]
  ratingStats: RatingStat[]
  isLoggedIn: boolean
}

export default function HomeClient({
  initialBooks,
  favorites,
  ratingStats,
  isLoggedIn,
}: HomeClientProps) {
  const [sortBy, setSortBy] = useState<SortKey>('year')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [eraFilter, setEraFilter] = useState<EraFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const ratingMap = useMemo(() => {
    const map = new Map<string, { avg: number; count: number }>()
    for (const stat of ratingStats) {
      map.set(stat.bookId, { avg: stat.avgValue, count: stat.ratingCount })
    }
    return map
  }, [ratingStats])

  const filteredBooks = useMemo(() => {
    const filtered = initialBooks.filter((book) => {
      // Region filter
      if (regionFilter !== 'all') {
        const isUK = book.tags.includes('欧美')
        const isJP = book.tags.includes('日系')
        if (regionFilter === 'uk' && !isUK) return false
        if (regionFilter === 'jp' && !isJP) return false
      }

      // Era filter
      if (eraFilter !== 'all') {
        const year = book.year
        if (eraFilter === 'pre-1980' && year >= 1980) return false
        if (eraFilter === '1980s' && (year < 1980 || year >= 1990)) return false
        if (eraFilter === '1990s' && (year < 1990 || year >= 2000)) return false
        if (eraFilter === '2000s' && (year < 2000 || year >= 2010)) return false
        if (eraFilter === '2010s' && (year < 2010 || year >= 2020)) return false
        if (eraFilter === '2020s' && (year < 2020 || year >= 2030)) return false
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'detective') {
          if (!book.tags.includes('本格推理') && !book.tags.includes('本格')) return false
        }
        if (typeFilter === 'standalone') {
          if (book.seriesId) return false
        }
        if (typeFilter === 'locked-room') {
          if (!book.tags.some((t) => ['孤岛悬疑', '不可能犯罪'].includes(t))) return false
        }
        if (typeFilter === 'serial') {
          if (!book.tags.includes('连环杀手')) return false
        }
      }

      return true
    })

    // Sort
    if (sortBy === 'year') {
      filtered.sort((a, b) => a.year - b.year)
    } else {
      filtered.sort((a, b) => {
        const aRating = ratingMap.get(a.id)
        const bRating = ratingMap.get(b.id)
        const aVal = aRating ? aRating.avg : a.rating
        const bVal = bRating ? bRating.avg : b.rating
        return bVal - aVal
      })
    }

    return filtered
  }, [initialBooks, sortBy, regionFilter, eraFilter, typeFilter, ratingMap])

  // Group books by year for chronological view
  const booksByYear = useMemo(() => {
    if (sortBy !== 'year') return null
    const groups = new Map<number, Book[]>()
    for (const book of filteredBooks) {
      const existing = groups.get(book.year) || []
      existing.push(book)
      groups.set(book.year, existing)
    }
    return groups
  }, [filteredBooks, sortBy])

  // Use cover_mark as CASE number
  const caseNumbers = useMemo(() => {
    const map = new Map<string, number>()
    initialBooks.forEach(book => {
      map.set(book.id, parseInt(book.coverMark || '000', 10))
    })
    return map
  }, [initialBooks])

  // Handle URL params for jump-to
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms))

    // ?focus=<bookId>：从搜索结果定位到具体书籍（搜索页「时间线」维度入口）
    const focusId = params.get('focus')
    if (focusId) {
      // 挂载时筛选必为全量（状态初值 all），无需清理，直接等 DOM 提交后定位
      later(() => {
        const el = document.querySelector(`[data-book-id="${focusId}"]`)
        if (!el) return
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('timeline-focus')
        later(() => el.classList.remove('timeline-focus'), 2600)
      }, 100)
    } else {
      // ?year=<year>：定位到年份分组
      const yearParam = params.get('year')
      if (yearParam) {
        const year = parseInt(yearParam)
        if (!isNaN(year)) {
          later(() => {
            const el = document.getElementById(`year-${year}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }
      }
    }

    // 卸载时清掉未触发的定时器，避免对已离开的组件操作
    return () => timers.forEach(clearTimeout)
  }, [])

  const clearFilters = () => {
    setRegionFilter('all')
    setEraFilter('all')
    setTypeFilter('all')
  }

  const hasActiveFilters = regionFilter !== 'all' || eraFilter !== 'all' || typeFilter !== 'all'

  return (
    <>
      <main>
        <header className="casebook-header">
          <div className="casebook-header-text">
            <h1 className="casebook-title">
              沿着时间线，
              <br />
              重走那些让人失眠的推理小说。
            </h1>
            <p className="casebook-subtitle">
              收录本格、社会派、硬核与经典欧美推理。按出版年份排列，可筛选、可搜索，也可以收藏和评分。
            </p>
          </div>

          <div className="casebook-controls">
            <div className="filter-group">
              <span className="filter-label">地区</span>
              <div className="filter-options">
                {regionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`filter-btn ${regionFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setRegionFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">年代</span>
              <div className="filter-options">
                {eraOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`filter-btn ${eraFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setEraFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">类型</span>
              <div className="filter-options">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`filter-btn ${typeFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setTypeFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                清除筛选
              </button>
            )}
          </div>

          <div className="casebook-meta">
            <span className="meta-item">
              显示 {filteredBooks.length} / {initialBooks.length} 部
            </span>
            <span className="meta-item">排序</span>
            <button
              className={`sort-btn ${sortBy === 'year' ? 'active' : ''}`}
              onClick={() => setSortBy('year')}
            >
              年份
            </button>
            <button
              className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
              onClick={() => setSortBy('rating')}
            >
              评分
            </button>
          </div>
        </header>

        <div className="casebook-timeline" id="timeline">
          {sortBy === 'year' && booksByYear ? (
            // Chronological view with year markers
            Array.from(booksByYear.entries()).map(([year, books]) => (
              <div key={year} className="year-group" id={`year-${year}`}>
                <div className="year-rail">
                  <span className="year-number">{year}</span>
                </div>
                <div className="year-books">
                  {books.map((book) => {
                    const caseNum = caseNumbers.get(book.id) || 0
                    const rating = ratingMap.get(book.id)
                    return (
                      <CasebookCard
                        key={book.id}
                        book={book}
                        caseNum={caseNum}
                        rating={rating}
                        favorites={favorites}
                        isLoggedIn={isLoggedIn}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            // Flat list view for rating sort
            filteredBooks.map((book) => {
              const caseNum = caseNumbers.get(book.id) || 0
              const rating = ratingMap.get(book.id)
              return (
                <CasebookCard
                  key={book.id}
                  book={book}
                  caseNum={caseNum}
                  rating={rating}
                  favorites={favorites}
                  isLoggedIn={isLoggedIn}
                />
              )
            })
          )}
        </div>
      </main>
    </>
  )
}

// Numeric rating display
function RatingDisplay({ value, count }: { value: number; count: number }) {
  if (count === 0) return <span className="rating-count">暂无评分</span>
  return (
    <span className="rating-value">{value.toFixed(1)} / 5</span>
  )
}

interface CasebookCardProps {
  book: Book
  caseNum: number
  rating?: { avg: number; count: number }
  favorites?: string[]
  isLoggedIn: boolean
}

function CasebookCard({
  book,
  caseNum,
  rating,
  favorites,
  isLoggedIn,
}: CasebookCardProps) {
  const avgRating = rating?.avg ?? 0
  const ratingCount = rating?.count ?? 0
  const isFavorite = favorites?.includes(book.id) ?? false
  const [favActive, setFavActive] = useState(isFavorite)
  const [favBusy, setFavBusy] = useState(false)

  // Determine series indicator
  const seriesIndicator = book.seriesName !== '单行本' ? book.seriesName : ''

  const handleToggleFavorite = async () => {
    if (favBusy || !isLoggedIn) return
    setFavBusy(true)
    try {
      const favorites = (await toggleFavorite(book.id))?.data?.favorites
      if (favorites) setFavActive(favorites.includes(book.id))
    } finally {
      setFavBusy(false)
    }
  }

  return (
    <div className="casebook-card" data-book-id={book.id}>
      <div className="card-cover">
        <Link href={`/books/${book.id}/reviews`}>
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={book.title}
              fill
              sizes="130px"
              className="cover-image"
            />
          ) : (
            <div className={`cover-placeholder ${book.coverTone}`}>
              <span className="cover-mark">{book.coverMark}</span>
            </div>
          )}
        </Link>
      </div>

      <div className="card-content">
        <p className="card-case">CASE {String(caseNum).padStart(3, '0')}</p>
        <div className="card-head">
          <Link href={`/books/${book.id}/reviews`} className="card-title-link">
            <h3 className="card-title">{book.title}</h3>
          </Link>
          {seriesIndicator && (
            <span className="card-series">{seriesIndicator}</span>
          )}
        </div>

        <div className="card-meta-row">
          <span>{book.authorName}</span>
          <span>{book.year}</span>
          <span>{book.readTime}</span>
        </div>

        <p className="card-blurb">{book.blurb}</p>

        <p className="card-tags">{book.tags.slice(0, 4).join('，')}</p>

        <div className="card-footer">
          <div className="card-rating">
            <RatingDisplay value={avgRating} count={ratingCount} />
            {ratingCount > 0 && (
              <span className="rating-count">({ratingCount} 人评)</span>
            )}
          </div>

          {isLoggedIn && (
            <button
              type="button"
              className={`favorite-button ${favActive ? 'active' : ''}`}
              onClick={handleToggleFavorite}
              disabled={favBusy}
            >
              {favActive ? '★ 已收藏' : '☆ 收藏'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
