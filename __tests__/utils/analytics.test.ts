import {
  trackCargoRequestDeleted,
  trackReviewSubmitted,
  trackUserRegistered,
} from '../../utils/analytics';
import { analytics } from '../../lib/firebase';

jest.mock('../../lib/firebase', () => ({
  analytics: {
    logEvent: jest.fn(),
  },
}));

describe('Analytics Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackCargoRequestDeleted', () => {
    it('should track cargo request deletion with all parameters', () => {
      trackCargoRequestDeleted({
        request_id: 'req123',
        cargo_type: 'automotive',
        had_bids: true,
        bid_count: 3,
      });

      expect(analytics.logEvent).toHaveBeenCalledWith('cargo_request_deleted', {
        request_id: 'req123',
        cargo_type: 'automotive',
        had_bids: true,
        bid_count: 3,
      });
    });

    it('should track deletion with zero bids', () => {
      trackCargoRequestDeleted({
        request_id: 'req456',
        cargo_type: 'general',
        had_bids: false,
        bid_count: 0,
      });

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'cargo_request_deleted',
        expect.objectContaining({
          had_bids: false,
          bid_count: 0,
        })
      );
    });

    it('should track different cargo types', () => {
      const cargoTypes = ['automotive', 'general', 'hazmat', 'fragile'];

      cargoTypes.forEach(cargoType => {
        trackCargoRequestDeleted({
          request_id: 'req789',
          cargo_type: cargoType,
          had_bids: false,
          bid_count: 0,
        });
      });

      expect(analytics.logEvent).toHaveBeenCalledTimes(4);
    });
  });

  describe('trackReviewSubmitted', () => {
    it('should track review submission with rating and comment', () => {
      trackReviewSubmitted({
        order_id: 'order123',
        rating: 5,
        has_comment: true,
      });

      expect(analytics.logEvent).toHaveBeenCalledWith('review_submitted', {
        order_id: 'order123',
        rating: 5,
        has_comment: true,
      });
    });

    it('should track review without comment', () => {
      trackReviewSubmitted({
        order_id: 'order456',
        rating: 4,
        has_comment: false,
      });

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'review_submitted',
        expect.objectContaining({
          has_comment: false,
        })
      );
    });

    it('should track all rating levels', () => {
      const ratings = [1, 2, 3, 4, 5];

      ratings.forEach(rating => {
        trackReviewSubmitted({
          order_id: `order${rating}`,
          rating,
          has_comment: true,
        });
      });

      expect(analytics.logEvent).toHaveBeenCalledTimes(5);
      // Verify all ratings were tracked
      ratings.forEach(rating => {
        expect(analytics.logEvent).toHaveBeenCalledWith(
          'review_submitted',
          expect.objectContaining({ rating })
        );
      });
    });

    it('should handle 1-star reviews (negative feedback)', () => {
      trackReviewSubmitted({
        order_id: 'order_neg',
        rating: 1,
        has_comment: true,
      });

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'review_submitted',
        expect.objectContaining({
          rating: 1,
        })
      );
    });
  });

  describe('trackUserRegistered', () => {
    it('should track private user registration', () => {
      trackUserRegistered({
        account_type: 'private',
        registration_method: 'email',
      });

      expect(analytics.logEvent).toHaveBeenCalledWith('user_registered', {
        account_type: 'private',
        registration_method: 'email',
      });
    });

    it('should track business user registration', () => {
      trackUserRegistered({
        account_type: 'business',
        registration_method: 'email',
      });

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'user_registered',
        expect.objectContaining({
          account_type: 'business',
        })
      );
    });

    it('should track different registration methods', () => {
      const methods = ['email', 'apple', 'google'];

      methods.forEach(method => {
        trackUserRegistered({
          account_type: 'private',
          registration_method: method,
        });
      });

      expect(analytics.logEvent).toHaveBeenCalledTimes(3);
    });

    it('should track both account types and all methods', () => {
      const accountTypes = ['private', 'business'];
      const methods = ['email', 'apple', 'google'];

      accountTypes.forEach(accountType => {
        methods.forEach(method => {
          trackUserRegistered({
            account_type: accountType as 'private' | 'business',
            registration_method: method,
          });
        });
      });

      expect(analytics.logEvent).toHaveBeenCalledTimes(6);
    });
  });

  describe('Analytics Event Consistency', () => {
    it('should always provide required parameters', () => {
      trackCargoRequestDeleted({
        request_id: 'req1',
        cargo_type: 'auto',
        had_bids: true,
        bid_count: 1,
      });

      trackReviewSubmitted({
        order_id: 'ord1',
        rating: 5,
        has_comment: true,
      });

      trackUserRegistered({
        account_type: 'business',
        registration_method: 'email',
      });

      // Verify all events were logged
      expect(analytics.logEvent).toHaveBeenCalledTimes(3);

      // Verify call signatures
      expect(analytics.logEvent).toHaveBeenNthCalledWith(
        1,
        'cargo_request_deleted',
        expect.any(Object)
      );
      expect(analytics.logEvent).toHaveBeenNthCalledWith(2, 'review_submitted', expect.any(Object));
      expect(analytics.logEvent).toHaveBeenNthCalledWith(3, 'user_registered', expect.any(Object));
    });
  });
});
