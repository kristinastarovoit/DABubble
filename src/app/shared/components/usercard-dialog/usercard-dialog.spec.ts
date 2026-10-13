import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsercardDialog } from './usercard-dialog';

describe('UsercardDialog', () => {
  let component: UsercardDialog;
  let fixture: ComponentFixture<UsercardDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsercardDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(UsercardDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
