// models/index.js
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE,
    process.env.MYSQL_USER,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        dialect: 'mysql',
        logging: false, // Set to true to see SQL queries in console
        define: {
            timestamps: false
        }
    }
);

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Define the Task Model
db.Task = sequelize.define('Task', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    priority: {
        type: DataTypes.STRING,
        allowNull: false
    },
    snapshotDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    }
}, {
    tableName: 'tasks',
    indexes: [
        {
            fields: ['snapshotDate']
        }
    ]
});

// Define the DailySnapshot Model
db.DailySnapshot = sequelize.define('DailySnapshot', {
    date: {
        type: DataTypes.DATEONLY,
        primaryKey: true,
        allowNull: false
    }
}, {
    tableName: 'daily_snapshots',
    timestamps: false
});

// Define the Unit Model
db.Unit = sequelize.define('Unit', {
    name: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
}, {
    tableName: 'units',
    timestamps: false
});

module.exports = db;