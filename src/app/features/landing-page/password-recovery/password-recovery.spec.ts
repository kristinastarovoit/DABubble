import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordRecovery } from './password-recovery';

describe('PasswordRecovery', () => {
  let component: PasswordRecovery;
  let fixture: ComponentFixture<PasswordRecovery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRecovery],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRecovery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
