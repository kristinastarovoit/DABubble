import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelHeader } from './channel-header';
import { ChannelService } from '../../../shared/services/channel-service';
import { DmService } from '../../../shared/services/dm-service';
import { AuthService } from '../../../shared/services/auth';
import { UserService } from '../../../shared/services/users';
import { Presence } from '../../../shared/services/presence';
import { FIREBASE_AUTH } from '../../../app.config';

describe('ChannelHeader', () => {
  let component: ChannelHeader;
  let fixture: ComponentFixture<ChannelHeader>;
  let dmService: {
    dmPartners: ReturnType<typeof vi.fn>;
    selectDm: ReturnType<typeof vi.fn>;
    addDm: ReturnType<typeof vi.fn>;
  };
  const currentUserId = 'current-user';
  const contacts = [
    {
      user: {
        uid: 'maria',
        name: 'Maria Garcia',
        email: 'maria.garcia@example.com',
        avatar: 'maria.png',
      },
      dm: { id: 'existing-dm' },
    },
    {
      user: {
        uid: 'max',
        name: 'Max Example',
        email: 'max@example.org',
        avatar: 'max.png',
      },
      dm: null,
    },
  ];

  beforeEach(async () => {
    dmService = {
      dmPartners: vi.fn(() => contacts),
      selectDm: vi.fn(),
      addDm: vi.fn().mockResolvedValue('new-dm'),
    };

    await TestBed.configureTestingModule({
      imports: [ChannelHeader],
      providers: [
        {
          provide: ChannelService,
          useValue: {
            channels: signal([
              { id: 'general', name: 'general' },
              { id: 'maria-room', name: 'maria' },
            ]),
            activeChannelId: signal(undefined),
            selectChannel: vi.fn(),
            getMessages: vi.fn(() => ({ unsubscribe: vi.fn() })),
          },
        },
        { provide: DmService, useValue: dmService },
        { provide: AuthService, useValue: { currentUserId: signal(currentUserId) } },
        { provide: UserService, useValue: { users: signal([]) } },
        { provide: Presence, useValue: { isOnline: vi.fn(() => false) } },
        { provide: FIREBASE_AUTH, useValue: { currentUser: { uid: currentUserId } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('suggests a matching email address separately from its contact', () => {
    component.recipientQuery = 'MARIA.GARCIA@EXAMPLE';

    expect(component.recipientSuggestions).toEqual([
      {
        type: 'email',
        id: 'maria',
        email: 'maria.garcia@example.com',
      },
    ]);
  });

  it('shows matching contact name and email as separate suggestions', () => {
    component.newMessageService.isNewMessageMode.set(true);
    component.recipientQuery = 'maria';
    component.showRecipientSuggestions.set(true);
    fixture.detectChanges();

    const suggestionElements = fixture.nativeElement.querySelectorAll(
      '.channel-header__new-message-suggestion',
    ) as NodeListOf<HTMLElement>;
    const suggestionLabels = Array.from(
      suggestionElements,
      (element) => element.textContent ?? '',
    );
    expect(suggestionLabels).toContain('Maria Garcia');
    expect(suggestionLabels).toContain('maria.garcia@example.com');
  });

  it('preserves channel and @contact searches', () => {
    component.recipientQuery = '#maria';
    expect(component.recipientSuggestions.map((suggestion) => suggestion.type)).toEqual(['channel']);

    component.recipientQuery = '@maria';
    expect(component.recipientSuggestions.map((suggestion) => suggestion.type)).toEqual([
      'user',
      'email',
    ]);
  });

  it('suggests only the matching field when the query matches name or email alone', () => {
    component.recipientQuery = 'garcia@example.com';
    expect(component.recipientSuggestions.map((suggestion) => suggestion.type)).toEqual(['email']);

    component.recipientQuery = 'Maria Garcia';
    expect(component.recipientSuggestions.map((suggestion) => suggestion.type)).toEqual(['user']);
  });

  it('opens the selected email-matched contact DM', async () => {
    component.recipientQuery = 'maria.garcia@exa';
    const [suggestion] = component.recipientSuggestions;
    if (!suggestion || suggestion.type !== 'email') throw new Error('Expected an email suggestion.');

    await component.selectRecipient(suggestion);

    expect(dmService.selectDm).toHaveBeenCalledWith('existing-dm');
  });

  it('creates a DM when selecting an email-matched contact without one', async () => {
    component.recipientQuery = 'max@example';
    const [suggestion] = component.recipientSuggestions;
    if (!suggestion || suggestion.type !== 'email') throw new Error('Expected an email suggestion.');

    await component.selectRecipient(suggestion);

    expect(dmService.addDm).toHaveBeenCalledWith([currentUserId, 'max']);
    expect(dmService.selectDm).toHaveBeenCalledWith('new-dm');
  });
});
