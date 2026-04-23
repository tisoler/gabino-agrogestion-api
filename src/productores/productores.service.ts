import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Productor } from '../entities/productor.entity';
import { CreateProductorDto } from './dto/create-productor.dto';

@Injectable()
export class ProductoresService {
  constructor(
    @InjectRepository(Productor)
    private productorRepository: Repository<Productor>,
  ) {}

  findAll(idEmpresa: number) {
    return this.productorRepository.find({ where: { idEmpresa } });
  }

  create(createProductorDto: CreateProductorDto, idEmpresa: number) {
    const productor = this.productorRepository.create({
        ...createProductorDto,
        idEmpresa: createProductorDto.idEmpresa ?? idEmpresa
    });
    return this.productorRepository.save(productor);
  }
}
