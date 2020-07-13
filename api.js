'use strict';

const response = require('./res');
const db = require('./conn');
const md5 = require('md5');
const crypto = require('crypto');
const cookie = require('cookie');

exports.newDiscussion = (req, res) => {
    const {session_id: sessionId, reply_to: replyTo, content} = req.body;
    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    if (userToken == null) {
        response.unauthorized("Unauthorized", res);
        return;
    }

    const queryUserId = `SELECT user_id FROM users WHERE user_token = ?`;
    const queryInsert = `INSERT INTO discussions (session_id, author_id, reply_to, content, timestamp) SELECT ?, ?, ?, ?, datetime() WHERE EXISTS (SELECT * FROM user_sessions WHERE user_id = ? AND session_id = ?)`;

    checkToken(userToken, (e, id) => {
        if (!e) {
            db.get(queryUserId, [userToken], (error, data) => {
                if (!error) {
                    db.run(queryInsert, [sessionId, data.user_id, replyTo, content, data.user_id, sessionId], (error2) => {
                        if (!error2) {
                            response.ok("New discussion entry posted.", res);
                        } else {
                            response.serverError(error, res);
                        }
                    });
                } else {
                    response.serverError(error, res);
                }
            });
        } else {
            response.unauthorized("Unauthorized", res);
        }
    });
};

exports.discussions = (req, res) => {
    const query = `SELECT discussion_id, author_id, author.user_name AS author_name, content, reply_to, timestamp FROM discussions INNER JOIN user_sessions ON user_sessions.session_id = discussions.session_id INNER JOIN users AS author ON discussions.author_id = author.user_id INNER JOIN users AS mhs ON user_sessions.user_id = mhs.user_id WHERE discussions.session_id = ? AND mhs.user_token = ?`;

    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    checkToken(userToken, (e, id) => {
        if (!e) {
            if (userToken == null) {
                response.unauthorized("Unauthorized", res);
            } else {
                const {session_id: sessionId} = req.body;
                db.all(query, [sessionId, userToken], (error, data) => {
                    if (!error) {
                        response.ok(data, res);
                    } else {
                        response.serverError(error, res);
                    }
                });
            }
        } else {
            response.unauthorized("Unauthorized", res);
        }
    });

};

exports.sessionDetails = (req, res) => {
    const query = "SELECT session_id, courses.course_id, course_name, course_lang, course_description, topic_title, topic_description, session_th, session_mode, classes.class_name, session_campus, session_room, dosen.user_id AS lecturer_id, dosen.user_name AS lecturer_name, session_startdate, session_enddate, can_talk, content FROM sessions INNER JOIN classes ON sessions.class_id = classes.class_id INNER JOIN courses ON classes.course_id = courses.course_id INNER JOIN user_classes ON classes.class_id = user_classes.class_id INNER JOIN users AS dosen ON classes.class_lecturer_id = dosen.user_id INNER JOIN users AS mahasiswa ON user_classes.user_id = mahasiswa.user_id INNER JOIN user_groups ON user_groups.group_id = mahasiswa.user_group WHERE sessions.session_id = ? AND mahasiswa.user_token = ?";

    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    checkToken(userToken, (e, id) => {
        if (!e) {
            if (userToken == null) {
                response.unauthorized("Unauthorized", res);
            } else {
                const {session_id: sessionId} = req.body;
                db.get(query, [sessionId, userToken], (error, row) => {
                    if (!error) {
                        if (row != null) {
                            response.ok(row, res);
                        } else {
                            response.notFound("No session found with that ID.", res);
                        }
                    } else {
                        response.serverError(error, res);
                    }
                });
            }
        } else {
            response.unauthorized("Unauthorized", res);
        }
    });

};

exports.getSessions = (req, res) => {
    // const query = "SELECT sessions.session_id, courses.course_id, course_name, session_th, session_mode, classes.class_name, topic_title, topic_description, session_campus, session_room, users.user_id AS lecturer_id, users.user_name AS lecturer_name, session_startdate, session_enddate FROM user_sessions INNER JOIN sessions ON user_sessions.session_id = sessions.session_id INNER JOIN classes ON sessions.class_id = classes.class_id INNER JOIN courses ON classes.course_id = courses.course_id INNER JOIN users ON classes.class_lecturer_id = users.user_id  WHERE user_sessions.user_id = (SELECT user_id FROM users WHERE user_token = ?)";

    const query = "SELECT sessions.session_id, courses.course_id, course_name, session_th, session_mode, classes.class_name, topic_title, topic_description, session_campus, session_room, users.user_id AS lecturer_id, users.user_name AS lecturer_name, session_startdate, session_enddate FROM user_classes INNER JOIN sessions ON sessions.class_id = user_classes.class_id INNER JOIN classes ON sessions.class_id = classes.class_id INNER JOIN courses ON classes.course_id = courses.course_id INNER JOIN users ON classes.class_lecturer_id = users.user_id  WHERE user_classes.user_id = (SELECT user_id FROM users WHERE user_token = ?) ORDER BY datetime(session_startdate)";

    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    checkToken(userToken, (e, id) => {
        if (!e) {
            if (userToken == null) {
                response.unauthorized("Unauthorized", res);
            } else {
                db.all(query, [userToken], (error, row) => {
                    if (!error) {
                        if (row.length > 0) {
                            response.ok(row, res);
                        } else {
                            response.notFound("No sessions found on your account.", res);
                        }
                    } else {
                        response.serverError(error, res);
                    }
                });
            }
        } else {
            response.unauthorized("Unauthorized", res);
        }
    });
};

exports.getProfilePicture = (req, res) => {
    const query = "SELECT * FROM users WHERE user_token = ?";
    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    checkToken(userToken, (e, id) => {
        if (!e) {
            db.get(query, [userToken], (error, row) => {
                if (!error) {
                    if (row != null) {
                        if (row.user_picture != null) {
                            res.type("image/jpeg");
                            res.send(Buffer.from(row.user_picture, "base64"));
                            res.end();
                        } else {
                            response.notFound("No profile picture set", res);
                        }
                    } else {
                        response.unauthorized("Unauthorized. Please login again.", res);
                    }
                } else {
                    response.serverError(error, res);
                }
            });
        } else {
            response.unauthorized("Unauthorized. Please login again.", res);
        }
    });
};

exports.profile = (req, res) => {
    const query = "SELECT user_id, user_name, departments.name AS department, user_email, group_name, is_staff, can_talk FROM users INNER JOIN user_groups ON users.user_group = user_groups.group_id INNER JOIN departments ON departments.id = users.department_id WHERE user_token = ?";
    const auth = req.get("authorization");
    const userToken = (auth == null) ? cookie.parse(req.headers.cookie || '').session_id : auth.split(" ").pop();

    checkTokenPromise(userToken).then((resolve) => {
        db.get(query, [userToken], (error, row) => {
            if (!error) {
                response.ok(row, res);
            } else {
                response.serverError(error, res);
            }
        });
    }).catch((reject => {
        if (reject.code === 403) {
            response.unauthorized(reject.message, res);
        } else {
            response.serverError(reject.message, res);
        }
    }));
};

exports.login = (req, res) => {
    const {user_email: userEmail, user_password: userPassword} = req.body;
    const query = "SELECT user_id FROM users WHERE user_email = ? AND user_password = ?";

    db.all (query, [userEmail, md5(userPassword)], function(error, row) {
        if (!error) {
            if (row.length === 1) {
                const session = generateKey();
                const query2 = "UPDATE users SET user_token = ? WHERE user_id = ?";

                console.log(row[0].user_id);
                db.run(query2, [session, row[0].user_id], (error2) => {
                    if (!error2) {
                        // log into database
                        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                        const userAgent = req.headers['user-agent'];
                        db.run(`INSERT INTO user_login_log VALUES (?, datetime(), ?, ?)`, [row[0].user_id, ipAddress, userAgent], (error3) => {
                            if (!error3) {
                                res.setHeader('Set-Cookie', cookie.serialize('session_id', session, {
                                    httpOnly: true,
                                    maxAge: 60 * 60 * 24 * 0.5 // 1 week
                                }));
                                response.ok({"session_id": session}, res);
                            }
                        });
                    } else {
                        response.serverError(error, res);
                        // console.log('b');
                    }
                });

            } else {
                response.unauthorized("Username or password is invalid.", res);
            }
        } else {
            response.serverError(error, res);
            // console.log('a');
        }
    });
};

exports.index = (req, res) => {
    response.ok("Hello from the Node JS RESTful side!", res)
};

exports.retrieveAllUsers = (req, res) => {
    const query = "SELECT user_id, user_name, departments.name,user_groups.group_name, user_groups.is_staff, user_groups.can_talk, user_email, user_picture FROM users INNER JOIN departments ON users.department_id = departments.id INNER JOIN user_groups ON users.user_group = user_groups.group_id"
    db.all(query, [], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.retrieveAllCourses = (req, res) => {
    const query = "SELECT * FROM courses"
    db.all(query, [], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.retrieveAllSessions = (req, res) => {
    const query = "SELECT sessions.session_id, courses.course_id, course_name, session_th, session_mode, classes.class_name, topic_title, topic_description, session_campus, session_room, users.user_id AS lecturer_id, users.user_name AS lecturer_name, session_startdate, session_enddate FROM user_classes INNER JOIN sessions ON sessions.class_id = user_classes.class_id INNER JOIN classes ON sessions.class_id = classes.class_id INNER JOIN courses ON classes.course_id = courses.course_id INNER JOIN users ON classes.class_lecturer_id = users.user_id ORDER BY datetime(session_startdate)"
    db.all(query, [], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.createNewUser = (req,res) => {
    const query = "INSERT INTO users (user_id, user_name, department_id, user_group, user_email, user_picture, user_password) VALUES (?,?,?,?,?,?,?)"
    db.run(query, [req.body.user_id, req.body.user_name, req.body.department_id, req.body.user_group, req.body.user_email, req.body.user_picture, req.body.user_password], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.createNewCourse = (req,res) => {
    const query = "INSERT INTO courses VALUES (?,?,?,?)"
    db.run(query, [req.body.course_id, req.body.course_name, req.body.course_description, req.body.course_lang], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.createNewSession = (req,res) => {
    const query = "INSERT INTO sessions (class_id, session_th, topic_title, topic_description, session_mode, session_startdate, session_enddate, session_campus, session_room) VALUES(?,?,?,?,?,?,?,?,?)"
    db.run(query, [req.body.class_id, req.body.session_th, req.body.topic_title, req.body.topic_description, req.body.session_mode, req.body.session_stardate, req.body.session_enddate, req.body.session_campus, req.body.session_room], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.updateExistingUser = (req,res) =>{
    const query = "UPDATE users SET user_name = ?, department_id = ?, user_group = ?, user_email = ?, user_picture = ?, user_password = ? WHERE user_id = ?"

    db.run(query, [req.body.user_name, req.body.department_id, req.body.user_group, req.body.user_email, req.body.user_picture, req.body.user_password,req.params.user_id], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.updateExistingCourse = (req,res) =>{
    const query = "UPDATE courses SET course_name = ?, course_description = ?, course_lang = ? WHERE course_id = ?"

    db.run(query, [req.body.course_name, req.body.course_description, req.body.course_lang, req.params.courseId], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

exports.updateExistingSession = (req,res) =>{
    const query = "UPDATE sessions SET class_id = ?, session_th = ?, topic_title = ?, topic_description = ?, session_mode = ?, session_startdate = ?, session_enddate = ?, session_campus = ?, session_room = ? WHERE session_id = ?"

    db.run(query, [req.body.class_id, req.body.session_th, req.body.topic_title, req.body.topic_description, req.body.session_mode, req.body.session_stardate, req.body.session_enddate, req.body.session_campus, req.body.session_room, req.params.sessionId], (error, row) => {
        if (!error) {
            response.ok(row, res);
        } else {
            response.serverError(error, res);
        }
    });
}

const generateKey = () => {
    return crypto.randomBytes(32).toString('base64');
};

const checkToken = (token, callback) => {
    const query = "SELECT user_id FROM USERS WHERE user_token = ?";
    db.all(query, [token], (error, rows) => {
       if (rows.length === 1) {
           callback(null, rows[0].user_id);
       } else {
           callback(403, null);
       }
    });
};

const checkTokenPromise = (token) => {
    return new Promise(((resolve, reject) => {
        const query = "SELECT user_id FROM USERS WHERE user_token = ?";
        db.all(query, [token], (error, rows) => {
            if (rows.length === 1) {
                resolve({id: rows[0].user_id});
            } else {
                reject({code: 403, message: "Unauthorized"});
            }
        });
    }));
};