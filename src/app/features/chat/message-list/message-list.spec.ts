import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageList } from './message-list';
import { UserService } from '../../../shared/services/users';
import { Presence } from '../../../shared/services/presence';
import { DmService } from '../../../shared/services/dm-service';
import { signal } from '@angular/core';

describe('MessageList', () => {
  let component: MessageList;
  let fixture: ComponentFixture<MessageList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageList],
      providers: [
        { provide: UserService, useValue: { users: () => [] } },
        { provide: Presence, useValue: { isOnline: () => false } },
        {
          provide: DmService,
          useValue: { openDmWith: async () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts at the latest message and only follows updates when already near the bottom', async () => {
    fixture.detectChanges();
    const messageList = fixture.nativeElement.querySelector('.message-list') as HTMLDivElement;
    Object.defineProperty(messageList, 'scrollHeight', { configurable: true, value: 600 });
    Object.defineProperty(messageList, 'clientHeight', { configurable: true, value: 200 });

    fixture.componentRef.setInput('scrollKey', 'channel-1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(messageList.scrollTop).toBe(600);

    messageList.scrollTop = 100;
    messageList.dispatchEvent(new Event('scroll'));
    fixture.componentRef.setInput('scrollKey', 'channel-2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(messageList.scrollTop).toBe(600);

    messageList.scrollTop = 100;
    messageList.dispatchEvent(new Event('scroll'));
    fixture.componentRef.setInput('messages', []);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(messageList.scrollTop).toBe(100);

    messageList.scrollTop = 100;
    messageList.dispatchEvent(new Event('scroll'));
    fixture.componentRef.setInput('messages', []);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(messageList.scrollTop).toBe(100);

    messageList.scrollTop = 330;
    messageList.dispatchEvent(new Event('scroll'));
    fixture.componentRef.setInput('messages', []);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(messageList.scrollTop).toBe(600);
  });
});
