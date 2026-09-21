import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DmHeader } from './dm-header';

describe('DmHeader', () => {
  let component: DmHeader;
  let fixture: ComponentFixture<DmHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DmHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(DmHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
