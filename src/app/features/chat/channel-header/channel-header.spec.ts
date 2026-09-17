import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChannelHeader } from './channel-header';

describe('ChannelHeader', () => {
  let component: ChannelHeader;
  let fixture: ComponentFixture<ChannelHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
