import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageChannelInput } from './message-channel-input';

describe('MessageChannelInput', () => {
  let component: MessageChannelInput;
  let fixture: ComponentFixture<MessageChannelInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageChannelInput],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageChannelInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
