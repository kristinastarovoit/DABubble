import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateChannel } from './create-channel';

describe('CreateChannel', () => {
  let component: CreateChannel;
  let fixture: ComponentFixture<CreateChannel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateChannel],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateChannel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
