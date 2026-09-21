import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactionPicker } from './reaction-picker';

describe('ReactionPicker', () => {
  let component: ReactionPicker;
  let fixture: ComponentFixture<ReactionPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactionPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactionPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
