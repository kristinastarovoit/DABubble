import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageChannelList } from './message-channel-list';

describe('MessageChannelList', () => {
  let component: MessageChannelList;
  let fixture: ComponentFixture<MessageChannelList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageChannelList],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageChannelList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
