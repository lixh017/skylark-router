package middleware

import (
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	windows map[uint][]time.Time
}

var limiter = &rateLimiter{
	windows: make(map[uint][]time.Time),
}

func init() {
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			limiter.cleanup()
		}
	}()
}

// Allow checks if the key is within its rate limit (req/min)
func Allow(keyID uint, limit int) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-1 * time.Minute)

	// Clean old entries
	entries := limiter.windows[keyID]
	clean := entries[:0]
	for _, t := range entries {
		if t.After(cutoff) {
			clean = append(clean, t)
		}
	}

	if len(clean) >= limit {
		limiter.windows[keyID] = clean
		return false
	}

	limiter.windows[keyID] = append(clean, now)
	return true
}

func (r *rateLimiter) cleanup() {
	r.mu.Lock()
	defer r.mu.Unlock()

	cutoff := time.Now().Add(-1 * time.Minute)
	for id, entries := range r.windows {
		clean := entries[:0]
		for _, t := range entries {
			if t.After(cutoff) {
				clean = append(clean, t)
			}
		}
		if len(clean) == 0 {
			delete(r.windows, id)
		} else {
			r.windows[id] = clean
		}
	}
}
