let server;
const {Rental} = require('../../models/rental');
const mongoose = require('mongoose');
const request =require('supertest');
const {User} = require('../../models/user');
const moment = require('moment');
const { Movie } = require('../../models/movie');

describe('/api/returns', ()=>{

    let customerId;
    let movieId;
    let rental;
    let token;
    let movie;

    beforeEach(async ()=> {
        server = require('../../index');
        customerId = mongoose.Types.ObjectId();
        movieId = mongoose.Types.ObjectId();
        token = new User().generateAuthToken();

        movie = new Movie({
            _id: movieId,
            title: '12345',
            dailyRentalRate: 2,
            genre: {name:'12345'},
            numberInStock: 10
        });

        await movie.save();

        rental = new Rental({
            customer: {
                _id: customerId,
                name: '12345',
                phone:'12345'
            },
            movie: {
                _id: movieId,
                title: '12345',
                dailyRentalRate: 2
            }
        });
        
        await rental.save();
    });

    afterEach(async ()=>{ 
        await server.close(); 
        await Rental.deleteMany({});
        await Movie.deleteMany({});
    });

    const exec = async ()=>{
        return await request(server)
        .post('/api/returns')
        .set('x-auth-token', token)
        .send({customerId, movieId});

    }

    it('should work!!', async ()=>{
        const result = await Rental.findById(rental._id);
        expect(result).not.toBeNull();
    });

    it('should return 401 if client is not logged', async ()=>{
        token = '';
        const res = await exec();
        expect(res.status).toBe(401);
    });

    it('should return 400 if the customerid is not provided', async ()=>{
        customerId = '';
        const res = await exec();

        expect(res.status).toBe(400);
    });

    it('should return 400 if the movieId is not provided', async ()=>{
        movieId = '';
        const res = await exec();

        expect(res.status).toBe(400);
    });

    it('should return 404 if not rental found for this customer/movie', async ()=>{
        await Rental.deleteMany({});
        const res = await exec();

        expect(res.status).toBe(404);
    });

    it('should return 400 if rental already processed', async ()=>{
        rental.dateReturned = new Date();
        await rental.save();
        const res = await exec();

        expect(res.status).toBe(400);
    });

    it('should return 200 if valid request', async ()=>{
        const res = await exec();

        expect(res.status).toBe(200);
    });

    it('should set the return date if is valid', async ()=>{
        const res = await exec();
        const rentalInDb = await Rental.findById(rental._id);
        const diff = new Date() - rentalInDb.dateReturned;

        expect(diff).toBeLessThan(10 * 1000);
    });

    it('should the rental fee', async ()=>{
        rental.dateOut = moment().add(-7, 'days').toDate();
        await rental.save();
        const res = await exec();
        const rentalInDb = await Rental.findById(rental._id);

        expect(rentalInDb.rentalFee).toBe(14);
    });

    it('should increase the movie stock', async ()=>{
        const res = await exec();
        const movieInDb = await Movie.findById(movie._id);

        expect(movieInDb.numberInStock).toBe(movie.numberInStock + 1);
    });

    it('should return the rental', async ()=>{
        const res = await exec();
        const rentalInDb = await Rental.findById(rental._id);

        expect(Object.keys(res.body)).toEqual(
            expect.arrayContaining(['dateOut', 'dateReturned', 'rentalFee', 'customer', 'movie'])
        );
    });
});