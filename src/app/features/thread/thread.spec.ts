import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Thread } from './thread';

describe('Thread', () => {
  let component: Thread;
  let fixture: ComponentFixture<Thread>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Thread],
    }).compileComponents();

    fixture = TestBed.createComponent(Thread);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
