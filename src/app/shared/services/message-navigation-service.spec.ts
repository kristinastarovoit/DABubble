import { TestBed } from '@angular/core/testing';
import { MessageNavigationService } from './message-navigation-service';

describe('MessageNavigationService', () => {
  let service: MessageNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MessageNavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
