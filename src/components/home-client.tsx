'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Book, UserData, RatingStat, TimelineReview } from '@/lib/types'
import { toggleFavorite } from '@/app/actions/user-data'
import { Typewriter } from '@/components/typewriter'

type SortKey = 'year' | 'rating'
type RegionFilter = 'all' | 'uk' | 'jp'
type EraFilter = 'all' | '1980s' | '1990s' | '2010s' | '2020s'
type TypeFilter = 'all' | 'detective' | 'standalone' | 'locked-room' | 'serial'

const regionOptions: { value: RegionFilter; label: string; field: 'REGION' }[] = [
  { value: 'all', label: '全部地区', field: 'REGION' },
  { value: 'uk', label: '欧美', field: 'REGION' },
  { value: 'jp', label: '日系', field: 'REGION' },
]

const eraOptions: { value: EraFilter; label: string; field: 'ERA' }[] = [
  { value: 'all', label: '全部年代', field: 'ERA' },
  { value: '1980s', label: '1980s', field: 'ERA' },
  { value: '1990s', label: '1990s', field: 'ERA' },
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
  userData?: UserData
  ratingStats: RatingStat[]
  timelineReviews: TimelineReview[]
  isLoggedIn: boolean
}

export default function HomeClient({
  initialBooks,
  userData,
  ratingStats,
  timelineReviews,
  isLoggedIn,
}: HomeClientProps) {
  const router = useRouter()

  const [sortBy, setSortBy] = useState<SortKey>('year')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [eraFilter, setEraFilter] = useState<EraFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [visibleCount, setVisibleCount] = useState(4)
  const [jumpToYear, setJumpToYear] = useState<number | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)


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
        if (eraFilter === '1980s' && (year < 1980 || year >= 1990)) return false
        if (eraFilter === '1990s' && (year < 1990 || year >= 2000)) return false
        if (eraFilter === '2010s' && (year < 2010 || year >= 2020)) return false
        if (eraFilter === '2020s' && (year < 2020 || year >= 2030)) return false
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'detective') {
          if (!book.tags.includes('本格推理') && !book.tags.includes('本格')) return false
        }
        if (typeFilter === 'standalone') {
          if (book.id !== 'our-houses' && book.id !== 'magpie-murders') return false
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

  // Assign CASE numbers based on year order
  const caseNumbers = useMemo(() => {
    const map = new Map<string, number>()
    const sorted = [...initialBooks].sort((a, b) => a.year - b.year)
    sorted.forEach((book, i) => {
      map.set(book.id, i + 1)
    })
    return map
  }, [initialBooks])

  // Ref callback (simplified - no animation)
  const itemRef = useCallback(
    (node: HTMLDivElement | null) => {
      // No-op for now
    },
    [],
  )

  // Handle URL params for jump-to
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const yearParam = params.get('year')
    if (yearParam) {
      const year = parseInt(yearParam)
      if (!isNaN(year)) {
        setJumpToYear(year)
        setTimeout(() => {
          const el = document.getElementById(`year-${year}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  }, [])

  const handleSortChange = (key: SortKey) => {
    setSortBy(key)
    setVisibleCount(4)
    setJumpToYear(null)
  }

  const clearFilters = () => {
    setRegionFilter('all')
    setEraFilter('all')
    setTypeFilter('all')
    setVisibleCount(4)
    setJumpToYear(null)
  }

  const hasActiveFilters = regionFilter !== 'all' || eraFilter !== 'all' || typeFilter !== 'all'

  return (
    <>
      <header className="casebook-header">
        <div className="casebook-header-text">
          <Typewriter
            texts={['每一本都是一场未完成的对话，等待被重新打开。', '沿着时间线，重走那些让人失眠的推理小说。']}
            speed={80}
            deleteSpeed={50}
            holdMs={2200}
          />
          <p className="casebook-subtitle">
            收录本格、社会派、硬核与经典欧美推理。向下滚动，时间线会持续延伸；每一个节点都记录一部值得反复回味的谜题、动机与余韵。
          </p>
        </div>

        <div className="casebook-controls">
          <div className="filter-group">
            <span className="filter-label">REGION</span>
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
            <span className="filter-label">ERA</span>
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
            <span className="filter-label">TYPE</span>
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
            显示 {filteredBooks.length} / {initialBooks.length} 案件
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item">
            排序
          </span>
          <button
            className={`sort-btn ${sortBy === 'year' ? 'active' : ''}`}
            onClick={() => handleSortChange('year')}
          >
            年份
          </button>
          <button
            className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
            onClick={() => handleSortChange('rating')}
          >
            评分
          </button>
        </div>
      </header>

      <div className="casebook-timeline" ref={timelineRef}>
        {sortBy === 'year' && booksByYear ? (
          // Chronological view with year markers
          Array.from(booksByYear.entries()).map(([year, books]) => (
            <div key={year} className="year-group" id={`year-${year}`}>
              <div className="year-marker">
                <span className="year-number">{year}</span>
                <span className="year-line" />
              </div>
              <div className="year-books">
                {books.map((book, idx) => {
                  const caseNum = caseNumbers.get(book.id) || 0
                  const rating = ratingMap.get(book.id)
                  return (
                    <CasebookCard
                      key={book.id}
                      book={book}
                      caseNum={caseNum}
                      rating={rating}
                      userData={userData}
                      isLoggedIn={isLoggedIn}
                      index={idx}
                      ref={itemRef}
                    />
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          // Flat list view for rating sort
          filteredBooks.map((book, idx) => {
            const caseNum = caseNumbers.get(book.id) || 0
            const rating = ratingMap.get(book.id)
            return (
              <CasebookCard
                key={book.id}
                book={book}
                caseNum={caseNum}
                rating={rating}
                userData={userData}
                isLoggedIn={isLoggedIn}
                index={idx}
                ref={itemRef}
              />
            )
          })
        )}
      </div>
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

// Separate component for casebook cards
import { forwardRef } from 'react'

interface CasebookCardProps {
  book: Book
  caseNum: number
  rating?: { avg: number; count: number }
  userData?: UserData
  isLoggedIn: boolean
  index: number
}

const CasebookCard = forwardRef<HTMLDivElement, CasebookCardProps>(
  ({ book, caseNum, rating, userData, isLoggedIn, index }, ref) => {
    const router = useRouter()
    const avgRating = rating?.avg ?? 0
    const ratingCount = rating?.count ?? 0
    const isFavorite = userData?.favorites.includes(book.id) ?? false
    const [favActive, setFavActive] = useState(isFavorite)
    const [favBusy, setFavBusy] = useState(false)

    // Determine series indicator
    const seriesIndicator = book.seriesName !== '单行本' ? book.seriesName : ''

    const handleToggleFavorite = async () => {
      if (favBusy || !isLoggedIn) return
      setFavBusy(true)
      const result = await toggleFavorite(book.id)
      if (result?.data) {
        setFavActive(result.data.favorites.includes(book.id))
      }
      setFavBusy(false)
    }

    return (
      <div
        ref={ref}
        className="casebook-card"
      >
        <div className="card-case-number">
          <span className="case-label">CASE</span>
          <span className="case-value">{String(caseNum).padStart(3, '0')}</span>
        </div>

        <div className="card-cover">
          <Link href={`/books/${book.id}/reviews`}>
            {book.coverUrl ? (
              <Image
                src={book.coverUrl}
                alt={book.title}
                fill
                sizes="160px"
                className="cover-image"
              />
            ) : (
              <div className={`cover-placeholder cover-${book.coverTone}`}>
                <span className="cover-mark">{book.coverMark}</span>
              </div>
            )}
          </Link>
        </div>

        <div className="card-content">
          <div className="card-head">
            <Link href={`/books/${book.id}/reviews`} className="card-title-link">
              <h3 className="card-title">{book.title}</h3>
            </Link>
            {seriesIndicator && (
              <span className="card-series">{seriesIndicator}</span>
            )}
          </div>

          <div className="card-meta-row">
            <span className="meta-author">{book.authorName}</span>
            <span className="meta-dot">·</span>
            <span className="meta-year">{book.year}</span>
            <span className="meta-dot">·</span>
            <span className="meta-readtime">{book.readTime}</span>
          </div>

          <p className="card-blurb">{book.blurb}</p>

          <div className="card-tags">
            {book.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>

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
  },
)

CasebookCard.displayName = 'CasebookCard'
